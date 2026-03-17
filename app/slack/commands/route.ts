import { NextRequest, NextResponse } from 'next/server';
import {
  enqueueTask,
  logStructured,
  postThreadMessage,
  upsertTaskThreadMapping,
  updateTaskSourceMeta,
  verifySlackSignature,
} from '@/lib/slackAutomation';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySlackSignature(request.headers, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const params = new URLSearchParams(rawBody);
  const prompt = (params.get('text') ?? '').trim();
  const teamId = params.get('team_id') ?? '';
  const channelId = params.get('channel_id') ?? '';
  const channelName = params.get('channel_name') ?? '';
  const userId = params.get('user_id') ?? '';
  const userName = params.get('user_name') ?? '';
  const command = params.get('command') ?? '/autotask';

  if (!prompt) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: /autotask <your task description>',
    });
  }

  try {
    const sourceMeta = {
      source: 'slack_command',
      command,
      team_id: teamId,
      user_id: userId,
      user_name: userName,
      channel_id: channelId,
      channel_name: channelName,
    };

    const queued = await enqueueTask({
      prompt,
      sourceMeta,
    });

    logStructured('command_received', {
      supabase_task_id: queued.id,
      team_id: teamId,
      channel_id: channelId,
      user_id: userId,
    });

    const anchorText = [
      'Task queued',
      `Task: \`${queued.id}\``,
      `Requested by: <@${userId}>`,
      `Prompt: ${prompt}`,
    ].join('\n');

    const postRes = await postThreadMessage({
      channelId,
      text: anchorText,
    });

    if (!postRes.ok) {
      logStructured('anchor_post_failed', {
        supabase_task_id: queued.id,
        channel_id: channelId,
        error: postRes.error,
      });

      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Task queued as ${queued.id}, but failed to post thread anchor: ${postRes.error}`,
      });
    }

    const threadTs = postRes.ts;
    await upsertTaskThreadMapping({
      supabaseTaskId: queued.id,
      rootSupabaseTaskId: queued.id,
      parentSupabaseTaskId: null,
      teamId,
      channelId,
      threadTs,
      rootMessageTs: threadTs,
      latestStatus: 'queued',
      queuedAt: queued.created_at,
    });

    await updateTaskSourceMeta(queued.id, {
      ...sourceMeta,
      thread_ts: threadTs,
      root_message_ts: threadTs,
    });

    logStructured('mapping_created', {
      supabase_task_id: queued.id,
      team_id: teamId,
      channel_id: channelId,
      thread_ts: threadTs,
    });

    return NextResponse.json({
      response_type: 'ephemeral',
      text: `Queued ${queued.id}. Updates will be posted in-thread.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStructured('command_error', {
      error: message,
      channel_id: channelId,
      user_id: userId,
    });

    return NextResponse.json({
      response_type: 'ephemeral',
      text: `Failed to queue task: ${message}`,
    });
  }
}
