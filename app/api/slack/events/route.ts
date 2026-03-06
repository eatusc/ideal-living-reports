import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  size: number;
  url_private_download?: string;
  url_private?: string;
}

interface SlackMessageEvent {
  type: string;
  subtype?: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  files?: SlackFile[];
}

interface SlackEventPayload {
  type: string;
  token?: string;
  challenge?: string;
  event?: SlackMessageEvent;
}

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const myHash =
    'v0=' +
    crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(myHash), Buffer.from(signature));
}

async function downloadSlackFile(
  url: string,
  botToken: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${botToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to download from Slack: ${res.status}`);
  }
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  // --- Signature verification ---
  if (process.env.AUTOMATION_SLACK_VERIFY_SIGNATURE === '1') {
    const signingSecret = process.env.AUTOMATION_SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
    const slackSig = request.headers.get('x-slack-signature') ?? '';

    if (!verifySlackSignature(signingSecret, timestamp, body, slackSig)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
  }

  const payload: SlackEventPayload = JSON.parse(body);

  // --- URL verification challenge (Slack sends this once when you set the endpoint) ---
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // --- Handle events ---
  if (payload.type === 'event_callback' && payload.event) {
    const event = payload.event;

    // Ignore bot messages and message edits/deletes
    if (event.subtype && event.subtype !== 'file_share') {
      return NextResponse.json({ ok: true });
    }

    const files = event.files;
    if (!files || files.length === 0) {
      // No files — just a text message, ignore or queue as text-only task
      return NextResponse.json({ ok: true });
    }

    // Process files
    const botToken = process.env.AUTOMATION_SLACK_BOT_TOKEN;
    const supabaseUrl = process.env.AUTOMATION_SUPABASE_URL;
    const supabaseKey = process.env.AUTOMATION_SUPABASE_SERVICE_ROLE_KEY;
    const queueTable = process.env.AUTOMATION_SUPABASE_QUEUE_TABLE ?? 'task_queue';
    const storageBucket = process.env.AUTOMATION_SUPABASE_STORAGE_BUCKET ?? 'slack-uploads';

    if (!botToken || !supabaseUrl || !supabaseKey) {
      console.error('[slack/events] Missing env vars (bot token or supabase)');
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const uploadedFiles: { name: string; path: string; publicUrl: string }[] = [];

    for (const file of files) {
      const downloadUrl = file.url_private_download ?? file.url_private;
      if (!downloadUrl) continue;

      try {
        const { buffer, contentType } = await downloadSlackFile(downloadUrl, botToken);

        // Store as: slack/<user>/<timestamp>-<filename>
        const storagePath = `slack/${event.user}/${event.ts}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error('[slack/events] Storage upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from(storageBucket)
          .getPublicUrl(storagePath);

        uploadedFiles.push({
          name: file.name,
          path: storagePath,
          publicUrl: urlData.publicUrl,
        });
      } catch (err) {
        console.error('[slack/events] File download/upload error:', err);
      }
    }

    // Queue a task row with file references
    const { error: insertError } = await supabase.from(queueTable).insert({
      prompt: event.text || '(file upload)',
      status: 'queued',
      input_artifacts: uploadedFiles.map((f) => f.publicUrl),
      source_meta: {
        source: 'slack',
        type: 'file_upload',
        user_id: event.user,
        channel_id: event.channel,
        ts: event.ts,
      },
    });

    if (insertError) {
      console.error('[slack/events] Supabase insert error:', insertError);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
