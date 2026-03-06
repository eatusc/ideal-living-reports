import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Slack sends slash commands as application/x-www-form-urlencoded POST
export async function POST(request: NextRequest) {
  const body = await request.text();
  const params = new URLSearchParams(body);

  // --- Signature verification ---
  if (process.env.AUTOMATION_SLACK_VERIFY_SIGNATURE === '1') {
    const signingSecret = process.env.AUTOMATION_SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      console.error('[slack/command] AUTOMATION_SLACK_SIGNING_SECRET not set');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
    const slackSig = request.headers.get('x-slack-signature') ?? '';

    // Reject requests older than 5 minutes (replay protection)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) {
      return NextResponse.json({ error: 'Request too old' }, { status: 403 });
    }

    const baseString = `v0:${timestamp}:${body}`;
    const myHash = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(myHash), Buffer.from(slackSig))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
  }

  // --- Parse the slash command payload ---
  const prompt = params.get('text') ?? '';
  const userId = params.get('user_id') ?? '';
  const userName = params.get('user_name') ?? '';
  const channelId = params.get('channel_id') ?? '';
  const channelName = params.get('channel_name') ?? '';
  const command = params.get('command') ?? '';

  if (!prompt.trim()) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: /autotask <your task description>',
    });
  }

  // --- Queue to Supabase ---
  const target = process.env.AUTOMATION_SLACK_TARGET ?? 'supabase';

  if (target === 'supabase') {
    const supabaseUrl = process.env.AUTOMATION_SUPABASE_URL;
    const supabaseKey = process.env.AUTOMATION_SUPABASE_SERVICE_ROLE_KEY;
    const queueTable = process.env.AUTOMATION_SUPABASE_QUEUE_TABLE ?? 'task_queue';

    if (!supabaseUrl || !supabaseKey) {
      console.error('[slack/command] Supabase env vars not set');
      return NextResponse.json({
        response_type: 'ephemeral',
        text: 'Server error: Supabase not configured.',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from(queueTable).insert({
      prompt,
      status: 'queued',
      source_meta: {
        source: 'slack',
        command,
        user_id: userId,
        user_name: userName,
        channel_id: channelId,
        channel_name: channelName,
      },
    });

    if (error) {
      console.error('[slack/command] Supabase insert error:', error);
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Failed to queue task: ${error.message}`,
      });
    }

    return NextResponse.json({
      response_type: 'ephemeral',
      text: `Queued: "${prompt}"\nSource: Slack (${userName}) -> Supabase`,
    });
  }

  // Fallback: unknown target
  return NextResponse.json({
    response_type: 'ephemeral',
    text: `Unknown target: ${target}`,
  });
}
