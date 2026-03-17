import { NextRequest, NextResponse } from 'next/server';
import {
  buildBlockedMessage,
  buildCompletionMessage,
  claimStatusPost,
  findTaskById,
  findTaskByLocalTaskId,
  findThreadMappingByTaskId,
  logStructured,
  markStatusPostPosted,
  postThreadMessage,
  upsertTaskThreadMapping,
} from '@/lib/slackAutomation';

interface TaskStatusPayload {
  supabase_task_id?: string;
  local_task_id?: string;
  status?: string;
  status_at?: string;
  idempotency_key?: string;
  blocked_question?: string;
  summary?: string;
  output_path?: string;
  team_id?: string;
  channel_id?: string;
  thread_ts?: string;
}

function normalizeStatus(raw: string): string {
  const value = raw.toLowerCase();
  if (value === 'succeeded') return 'completed';
  return value;
}

function getStatusPostText(taskId: string, payload: TaskStatusPayload, status: string, statusAt: string): string {
  if (status === 'blocked') {
    const question = (payload.blocked_question ?? '').trim() || 'What should I do next?';
    return buildBlockedMessage({ taskId, question });
  }

  if (status === 'completed') {
    return buildCompletionMessage({
      taskId,
      status,
      completedAt: statusAt,
      summary: payload.summary,
      outputPath: payload.output_path,
    });
  }

  return [`Status update: ${status}`, `Task: \`${taskId}\``, `At: ${statusAt}`].join('\n');
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.AUTOMATION_TASK_STATUS_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const providedSecret = request.headers.get('x-automation-webhook-secret') ?? '';
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: TaskStatusPayload;
  try {
    payload = (await request.json()) as TaskStatusPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawStatus = payload.status?.trim() ?? '';
  if (!rawStatus) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  const status = normalizeStatus(rawStatus);
  const statusAt = payload.status_at ?? new Date().toISOString();

  try {
    let supabaseTaskId = payload.supabase_task_id?.trim() ?? '';

    if (!supabaseTaskId && payload.local_task_id) {
      const task = await findTaskByLocalTaskId(payload.local_task_id);
      supabaseTaskId = (task?.id as string) ?? '';
    }

    if (!supabaseTaskId) {
      return NextResponse.json({ error: 'supabase_task_id or known local_task_id is required' }, { status: 400 });
    }

    let mapping = await findThreadMappingByTaskId(supabaseTaskId);

    if (!mapping) {
      const task = await findTaskById(supabaseTaskId);
      const sourceMeta = (task?.source_meta as Record<string, unknown> | undefined) ?? {};
      const channelId = (payload.channel_id ?? sourceMeta.channel_id) as string | undefined;
      const threadTs = (payload.thread_ts ?? sourceMeta.thread_ts ?? sourceMeta.root_message_ts) as string | undefined;
      const teamId = (payload.team_id ?? sourceMeta.team_id) as string | undefined;

      if (!channelId || !threadTs || !teamId) {
        logStructured('status_missing_mapping', {
          supabase_task_id: supabaseTaskId,
          status,
          status_at: statusAt,
        });
        return NextResponse.json({ ok: true, ignored: 'missing_mapping' });
      }

      await upsertTaskThreadMapping({
        supabaseTaskId,
        rootSupabaseTaskId: (task?.parent_task_id as string | null) ? (task?.parent_task_id as string) : supabaseTaskId,
        parentSupabaseTaskId: (task?.parent_task_id as string | null) ?? null,
        localTaskId: (payload.local_task_id ?? (task?.local_task_id as string | null)) ?? null,
        teamId,
        channelId,
        threadTs,
        rootMessageTs: threadTs,
        latestStatus: status,
      });

      mapping = await findThreadMappingByTaskId(supabaseTaskId);
    }

    if (!mapping) {
      return NextResponse.json({ ok: true, ignored: 'mapping_unavailable' });
    }

    const idempotencyKey =
      payload.idempotency_key ??
      `${supabaseTaskId}:${status}:${statusAt}:${payload.local_task_id ?? ''}:${payload.summary ?? ''}`;

    const claimPayload = {
      supabase_task_id: supabaseTaskId,
      local_task_id: payload.local_task_id ?? null,
      status,
      status_at: statusAt,
      channel_id: mapping.channel_id,
      thread_ts: mapping.thread_ts,
      payload_json: payload,
    };

    const claimed = await claimStatusPost(idempotencyKey, claimPayload);
    if (!claimed) {
      logStructured('status_duplicate_ignored', {
        idempotency_key: idempotencyKey,
        supabase_task_id: supabaseTaskId,
        status,
      });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const text = getStatusPostText(supabaseTaskId, payload, status, statusAt);
    const postRes = await postThreadMessage({
      channelId: mapping.channel_id,
      threadTs: mapping.thread_ts,
      text,
    });

    if (!postRes.ok) {
      logStructured('status_post_failed', {
        supabase_task_id: supabaseTaskId,
        status,
        error: postRes.error,
      });
      return NextResponse.json({ ok: false, error: postRes.error }, { status: 502 });
    }

    await markStatusPostPosted(idempotencyKey, postRes.ts);

    await upsertTaskThreadMapping({
      supabaseTaskId,
      rootSupabaseTaskId: mapping.root_supabase_task_id,
      parentSupabaseTaskId: mapping.parent_supabase_task_id,
      localTaskId: payload.local_task_id ?? mapping.local_task_id,
      teamId: mapping.team_id,
      channelId: mapping.channel_id,
      threadTs: mapping.thread_ts,
      rootMessageTs: mapping.root_message_ts,
      latestStatus: status,
      blockedQuestion: status === 'blocked' ? payload.blocked_question ?? null : mapping.blocked_question,
      blockedAt: status === 'blocked' ? statusAt : mapping.blocked_at,
      completedAt: status === 'completed' ? statusAt : mapping.completed_at,
      lastStatusPostedAt: statusAt,
    });

    logStructured('status_posted', {
      supabase_task_id: supabaseTaskId,
      local_task_id: payload.local_task_id,
      status,
      channel_id: mapping.channel_id,
      thread_ts: mapping.thread_ts,
      posted_message_ts: postRes.ts,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStructured('task_status_error', {
      error: message,
      status,
      supabase_task_id: payload.supabase_task_id,
      local_task_id: payload.local_task_id,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
