import { NextRequest, NextResponse } from 'next/server';
import {
  appendInputToLocalTask,
  claimSlackEvent,
  enqueueTask,
  findBestThreadMappingByThread,
  logStructured,
  postThreadMessage,
  upsertTaskThreadMapping,
  verifySlackSignature,
  type SlackEventPayload,
} from '@/lib/slackAutomation';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifySlackSignature(request.headers, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.event_id) {
    try {
      const claimed = await claimSlackEvent(payload.event_id, payload.team_id, payload.event?.type);
      if (!claimed) {
        logStructured('event_duplicate_ignored', { event_id: payload.event_id });
        return NextResponse.json({ ok: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logStructured('event_dedupe_error', {
        event_id: payload.event_id,
        error: message,
      });
      return NextResponse.json({ ok: true });
    }
  }

  if (payload.type !== 'event_callback' || !payload.event) {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  if (event.type !== 'message') {
    return NextResponse.json({ ok: true });
  }

  if (event.subtype || event.bot_id) {
    return NextResponse.json({ ok: true });
  }

  const text = (event.text ?? '').trim();
  const channelId = event.channel ?? '';
  const teamId = payload.team_id ?? '';
  const threadTs = event.thread_ts ?? '';

  if (!text || !channelId || !threadTs) {
    return NextResponse.json({ ok: true });
  }

  try {
    const mapping = await findBestThreadMappingByThread(channelId, threadTs);
    if (!mapping) {
      logStructured('reply_missing_mapping', {
        event_id: payload.event_id,
        team_id: teamId,
        channel_id: channelId,
        thread_ts: threadTs,
      });
      return NextResponse.json({ ok: true });
    }

    logStructured('reply_consumed', {
      event_id: payload.event_id,
      parent_supabase_task_id: mapping.supabase_task_id,
      local_task_id: mapping.local_task_id,
      channel_id: channelId,
      thread_ts: threadTs,
      user_id: event.user,
    });

    const replyMeta = {
      source: 'slack_thread_reply',
      team_id: teamId,
      channel_id: channelId,
      thread_ts: threadTs,
      user_id: event.user,
      event_id: payload.event_id,
      parent_supabase_task_id: mapping.supabase_task_id,
      message_ts: event.ts,
    };

    const replyMode = (process.env.AUTOMATION_SLACK_REPLY_MODE ?? 'always_child').trim().toLowerCase();
    const tryResumeFirst = replyMode === 'resume_then_child';

    let resumedLocal = false;
    if (tryResumeFirst && mapping.local_task_id) {
      resumedLocal = await appendInputToLocalTask({
        localTaskId: mapping.local_task_id,
        input: text,
        sourceMeta: replyMeta,
      });
    }

    if (resumedLocal) {
      await postThreadMessage({
        channelId,
        threadTs,
        text: `Reply received and routed to local task \`${mapping.local_task_id}\`.`,
      });
      return NextResponse.json({ ok: true });
    }

    const childTask = await enqueueTask({
      prompt: text,
      parentTaskId: mapping.supabase_task_id,
      sourceMeta: replyMeta,
    });

    await upsertTaskThreadMapping({
      supabaseTaskId: childTask.id,
      rootSupabaseTaskId: mapping.root_supabase_task_id || mapping.supabase_task_id,
      parentSupabaseTaskId: mapping.supabase_task_id,
      teamId: mapping.team_id || teamId,
      channelId,
      threadTs,
      rootMessageTs: mapping.root_message_ts || threadTs,
      latestStatus: 'queued',
      queuedAt: childTask.created_at,
    });

    logStructured('follow_up_task_enqueued', {
      parent_supabase_task_id: mapping.supabase_task_id,
      child_supabase_task_id: childTask.id,
      channel_id: channelId,
      thread_ts: threadTs,
    });

    await postThreadMessage({
      channelId,
      threadTs,
      text: `Reply received. Queued follow-up task \`${childTask.id}\` (parent: \`${mapping.supabase_task_id}\`).`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStructured('event_processing_error', {
      event_id: payload.event_id,
      error: message,
      channel_id: channelId,
      thread_ts: threadTs,
    });

    return NextResponse.json({ ok: true });
  }
}
