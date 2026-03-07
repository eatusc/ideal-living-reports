import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import https from 'https';
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
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { Authorization: `Bearer ${botToken}` },
      // Slack's file CDN can have cert chain issues on some runtimes
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        downloadSlackFile(res.headers.location, botToken).then(resolve).catch(reject);
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`Failed to download from Slack: ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: res.headers['content-type'] ?? 'application/octet-stream',
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.end();
  });
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

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error('[slack/events] Failed to parse JSON body:', body.slice(0, 500));
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[slack/events] Received:', payload.type, payload.event?.type, payload.event?.subtype, 'files:', payload.event?.files?.length ?? 0);

  // --- URL verification challenge (Slack sends this once when you set the endpoint) ---
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // --- Handle events ---
  if (payload.type === 'event_callback' && payload.event) {
    const event = payload.event;

    // Ignore bot messages and message edits/deletes (allow file_share and plain messages)
    if (event.subtype && event.subtype !== 'file_share') {
      console.log('[slack/events] Ignoring subtype:', event.subtype);
      return NextResponse.json({ ok: true });
    }

    const files = event.files;
    const hasFiles = files && files.length > 0;
    const hasText = !!event.text?.trim();

    if (!hasFiles && !hasText) {
      console.log('[slack/events] No files or text in event, skipping');
      return NextResponse.json({ ok: true });
    }

    console.log('[slack/events]', hasFiles ? `Processing ${files!.length} file(s): ${files!.map(f => f.name).join(', ')}` : 'Text-only message');

    const botToken = process.env.AUTOMATION_SLACK_BOT_TOKEN;
    const supabaseUrl = process.env.AUTOMATION_SUPABASE_URL;
    const supabaseKey = process.env.AUTOMATION_SUPABASE_SERVICE_ROLE_KEY;
    const queueTable = process.env.AUTOMATION_SUPABASE_QUEUE_TABLE ?? 'task_queue';
    const storageBucket = process.env.AUTOMATION_SUPABASE_STORAGE_BUCKET ?? 'slack-uploads';

    if (!supabaseUrl || !supabaseKey) {
      console.error('[slack/events] Missing env vars (supabase)');
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const uploadedFiles: { name: string; path: string; publicUrl: string }[] = [];

    // Download and upload files to Supabase Storage if present
    if (hasFiles && botToken) {
      for (const file of files!) {
        const downloadUrl = file.url_private_download ?? file.url_private;
        if (!downloadUrl) continue;

        try {
          console.log('[slack/events] Downloading:', file.name, 'from', downloadUrl.slice(0, 80));
          const { buffer, contentType } = await downloadSlackFile(downloadUrl, botToken);
          console.log('[slack/events] Downloaded:', file.name, buffer.length, 'bytes');

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
    } else if (hasFiles && !botToken) {
      console.error('[slack/events] Missing AUTOMATION_SLACK_BOT_TOKEN, cannot download files');
    }

    // Queue a task row
    const taskType = hasFiles ? 'file_upload' : 'message';
    const { error: insertError } = await supabase.from(queueTable).insert({
      prompt: event.text?.trim() || '(file upload)',
      status: 'queued',
      ...(uploadedFiles.length > 0 && { input_artifacts: uploadedFiles.map((f) => f.publicUrl) }),
      source_meta: {
        source: 'slack',
        type: taskType,
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
