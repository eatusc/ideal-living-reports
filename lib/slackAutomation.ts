import crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TaskStatus = 'queued' | 'queued_local' | 'running' | 'in_progress' | 'blocked' | 'completed' | 'failed' | 'error';

export interface SlackTaskThreadRow {
  supabase_task_id: string;
  root_supabase_task_id: string;
  parent_supabase_task_id: string | null;
  local_task_id: string | null;
  team_id: string;
  channel_id: string;
  thread_ts: string;
  root_message_ts: string;
  latest_status: string | null;
  blocked_question: string | null;
  queued_at: string | null;
  blocked_at: string | null;
  completed_at: string | null;
  last_status_posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlackEventPayload {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  event?: SlackMessageEvent;
  type: string;
  event_id?: string;
  event_time?: number;
  challenge?: string;
}

export interface SlackMessageEvent {
  type: string;
  subtype?: string;
  bot_id?: string;
  user?: string;
  text?: string;
  channel?: string;
  thread_ts?: string;
  ts?: string;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  message?: unknown;
}

interface QueueTaskInput {
  prompt: string;
  parentTaskId?: string | null;
  sourceMeta: Record<string, unknown>;
  inputArtifacts?: string[];
}

interface UpsertThreadInput {
  supabaseTaskId: string;
  rootSupabaseTaskId?: string;
  parentSupabaseTaskId?: string | null;
  localTaskId?: string | null;
  teamId: string;
  channelId: string;
  threadTs: string;
  rootMessageTs?: string;
  latestStatus?: string;
  blockedQuestion?: string | null;
  queuedAt?: string | null;
  blockedAt?: string | null;
  completedAt?: string | null;
  lastStatusPostedAt?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value ?? '';
}

export function logStructured(event: string, details: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      ts: nowIso(),
      component: 'slack-webhook',
      event,
      ...details,
    })
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = getEnv('AUTOMATION_SUPABASE_URL');
  const key = getEnv('AUTOMATION_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

export function getQueueTable(): string {
  return process.env.AUTOMATION_SUPABASE_QUEUE_TABLE ?? 'task_queue';
}

export function verifySlackSignature(headers: Headers, rawBody: string): boolean {
  if (process.env.AUTOMATION_SLACK_VERIFY_SIGNATURE !== '1') return true;

  const signingSecret = process.env.AUTOMATION_SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = headers.get('x-slack-request-timestamp') ?? '';
  const signature = headers.get('x-slack-signature') ?? '';

  if (!timestamp || !signature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected =
    'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function slackApiPost(
  method: string,
  payload: Record<string, unknown>,
  maxAttempts = 3
): Promise<SlackApiResponse> {
  const botToken = getEnv('AUTOMATION_SLACK_BOT_TOKEN');

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`https://slack.com/api/${method}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const body = (await res.json()) as SlackApiResponse;
      if (res.ok && body.ok) return body;

      lastError = body.error ?? `http_${res.status}`;
      const retryAfterSec = Number(res.headers.get('retry-after') ?? '0');
      const shouldRetry =
        attempt < maxAttempts &&
        (res.status >= 500 || res.status === 429 || lastError === 'ratelimited' || lastError === 'internal_error');

      logStructured('slack_api_error', {
        method,
        attempt,
        status_code: res.status,
        error: lastError,
        retry_after_sec: retryAfterSec,
        will_retry: shouldRetry,
      });

      if (!shouldRetry) break;
      const backoffMs = retryAfterSec > 0 ? retryAfterSec * 1000 : 250 * 2 ** (attempt - 1);
      await sleep(backoffMs);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const shouldRetry = attempt < maxAttempts;
      logStructured('slack_api_exception', {
        method,
        attempt,
        error: lastError,
        will_retry: shouldRetry,
      });
      if (!shouldRetry) break;
      await sleep(250 * 2 ** (attempt - 1));
    }
  }

  return { ok: false, error: lastError ?? 'unknown_error' };
}

export async function postThreadMessage(params: {
  channelId: string;
  text: string;
  threadTs?: string;
}): Promise<{ ok: true; ts: string } | { ok: false; error: string }> {
  const payload: Record<string, unknown> = {
    channel: params.channelId,
    text: params.text,
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false,
  };

  if (params.threadTs) payload.thread_ts = params.threadTs;

  const res = await slackApiPost('chat.postMessage', payload);
  if (!res.ok || !res.ts) {
    return { ok: false, error: res.error ?? 'missing_ts' };
  }
  return { ok: true, ts: res.ts };
}

export async function enqueueTask(input: QueueTaskInput): Promise<{ id: string; created_at: string }> {
  const supabase = getSupabaseAdmin();
  const queueTable = getQueueTable();

  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    status: 'queued',
    source_meta: input.sourceMeta,
  };

  if (input.parentTaskId) payload.parent_task_id = input.parentTaskId;
  if (input.inputArtifacts && input.inputArtifacts.length > 0) {
    payload.input_artifacts = input.inputArtifacts;
  }

  const { data, error } = await supabase
    .from(queueTable)
    .insert(payload)
    .select('id,created_at')
    .single();

  if (error || !data) {
    throw new Error(`Failed to enqueue task: ${error?.message ?? 'unknown error'}`);
  }
  return data;
}

export async function updateTaskSourceMeta(
  taskId: string,
  sourceMeta: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const queueTable = getQueueTable();

  const { error } = await supabase
    .from(queueTable)
    .update({ source_meta: sourceMeta })
    .eq('id', taskId);

  if (error) {
    throw new Error(`Failed to update task source_meta: ${error.message}`);
  }
}

export async function findTaskById(taskId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdmin();
  const queueTable = getQueueTable();

  const { data, error } = await supabase
    .from(queueTable)
    .select('*')
    .eq('id', taskId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load task by id: ${error.message}`);
  }
  return data;
}

export async function findTaskByLocalTaskId(localTaskId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdmin();
  const queueTable = getQueueTable();

  const { data, error } = await supabase
    .from(queueTable)
    .select('*')
    .eq('local_task_id', localTaskId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load task by local_task_id: ${error.message}`);
  }
  return data;
}

export async function upsertTaskThreadMapping(input: UpsertThreadInput): Promise<void> {
  const supabase = getSupabaseAdmin();

  const row = {
    supabase_task_id: input.supabaseTaskId,
    root_supabase_task_id: input.rootSupabaseTaskId ?? input.supabaseTaskId,
    parent_supabase_task_id: input.parentSupabaseTaskId ?? null,
    local_task_id: input.localTaskId ?? null,
    team_id: input.teamId,
    channel_id: input.channelId,
    thread_ts: input.threadTs,
    root_message_ts: input.rootMessageTs ?? input.threadTs,
    latest_status: input.latestStatus ?? null,
    blocked_question: input.blockedQuestion ?? null,
    queued_at: input.queuedAt ?? null,
    blocked_at: input.blockedAt ?? null,
    completed_at: input.completedAt ?? null,
    last_status_posted_at: input.lastStatusPostedAt ?? null,
    updated_at: nowIso(),
  };

  const { error } = await supabase.from('slack_task_threads').upsert(row, {
    onConflict: 'supabase_task_id',
  });

  if (error) {
    throw new Error(`Failed to upsert slack_task_threads: ${error.message}`);
  }
}

export async function findThreadMappingByTaskId(taskId: string): Promise<SlackTaskThreadRow | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('slack_task_threads')
    .select('*')
    .eq('supabase_task_id', taskId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load thread mapping by task id: ${error.message}`);
  }
  return data as SlackTaskThreadRow | null;
}

function pickBestThreadRow(rows: SlackTaskThreadRow[]): SlackTaskThreadRow | null {
  if (!rows.length) return null;

  const active = rows.find((r) => ['blocked', 'running', 'in_progress', 'queued', 'queued_local'].includes(r.latest_status ?? ''));
  return active ?? rows[0];
}

export async function findBestThreadMappingByThread(
  channelId: string,
  threadTs: string
): Promise<SlackTaskThreadRow | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('slack_task_threads')
    .select('*')
    .eq('channel_id', channelId)
    .eq('thread_ts', threadTs)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to load thread mappings by thread: ${error.message}`);
  }

  return pickBestThreadRow((data ?? []) as SlackTaskThreadRow[]);
}

export async function claimSlackEvent(eventId: string, teamId?: string, eventType?: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('slack_event_dedupe')
    .upsert(
      {
        event_id: eventId,
        team_id: teamId ?? null,
        event_type: eventType ?? null,
        received_at: nowIso(),
      },
      { onConflict: 'event_id', ignoreDuplicates: true }
    )
    .select('event_id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to upsert slack_event_dedupe: ${error.message}`);
  }
  return Boolean(data?.event_id);
}

export async function claimStatusPost(idempotencyKey: string, payload: Record<string, unknown>): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('task_status_posts')
    .upsert(
      {
        idempotency_key: idempotencyKey,
        ...payload,
      },
      {
        onConflict: 'idempotency_key',
        ignoreDuplicates: true,
      }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to upsert task_status_posts: ${error.message}`);
  }

  return Boolean(data?.id);
}

export async function markStatusPostPosted(
  idempotencyKey: string,
  postedMessageTs: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('task_status_posts')
    .update({ posted_message_ts: postedMessageTs, posted_at: nowIso() })
    .eq('idempotency_key', idempotencyKey);

  if (error) {
    throw new Error(`Failed to update task_status_posts posted state: ${error.message}`);
  }
}

export async function appendInputToLocalTask(params: {
  localTaskId: string;
  input: string;
  sourceMeta: Record<string, unknown>;
}): Promise<boolean> {
  const baseUrl = process.env.AUTOMATION_LOCAL_TASK_API_BASE_URL;
  if (!baseUrl) return false;

  const authToken = process.env.AUTOMATION_LOCAL_TASK_API_BEARER_TOKEN;
  const sharedSecret = process.env.AUTOMATION_LOCAL_TASK_API_SHARED_SECRET;

  const target = `${baseUrl.replace(/\/$/, '')}/api/prompt-tasks/${encodeURIComponent(params.localTaskId)}/input`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (sharedSecret) headers['x-automation-shared-secret'] = sharedSecret;

  const res = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input: params.input,
      source_meta: params.sourceMeta,
    }),
  });

  if (!res.ok) {
    logStructured('local_input_append_failed', {
      local_task_id: params.localTaskId,
      status_code: res.status,
    });
    return false;
  }

  logStructured('local_input_append_success', {
    local_task_id: params.localTaskId,
  });
  return true;
}

export function formatSlackTaskRef(taskId: string): string {
  return '`' + taskId + '`';
}

export function buildCompletionMessage(params: {
  taskId: string;
  status: string;
  completedAt: string;
  summary?: string;
  outputPath?: string;
}): string {
  const lines = [
    `Completed (${params.status})`,
    `Task: ${formatSlackTaskRef(params.taskId)}`,
    `At: ${params.completedAt}`,
  ];
  if (params.summary) lines.push(`Summary: ${params.summary}`);
  if (params.outputPath) lines.push(`Output: ${params.outputPath}`);
  return lines.join('\n');
}

export function buildBlockedMessage(params: {
  taskId: string;
  question: string;
}): string {
  return [`Blocked: ${params.question}`, `Task: ${formatSlackTaskRef(params.taskId)}`].join('\n');
}
