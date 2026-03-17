# Slack Thread-Mapped Automation (Local Executor via Supabase)

## 1) Implementation plan mapped to files

- `lib/slackAutomation.ts`
  - shared helpers: signature verification, Slack API retry/backoff, structured logging, queue insert, mapping persistence, idempotency claims, optional local task input append.
- `app/slack/commands/route.ts`
  - canonical slash command edge endpoint (`POST /slack/commands`).
  - queues task -> posts thread anchor -> saves mapping.
- `app/slack/events/route.ts`
  - canonical Slack events endpoint (`POST /slack/events`).
  - dedupes by `event_id`, consumes in-thread replies, routes to local task input when possible, else enqueues follow-up child task and maps to same thread.
- `app/task-status/route.ts`
  - canonical status webhook (`POST /task-status`) from local executor.
  - auth via shared secret, idempotent status posting, thread update posting for blocked/completed/other statuses.
- `app/api/slack/command/route.ts`
  - backward-compatible wrapper to `POST /slack/commands` handler.
- `app/api/slack/events/route.ts`
  - backward-compatible wrapper to `POST /slack/events` handler.
- `app/api/task-status/route.ts`
  - backward-compatible wrapper to `POST /task-status` handler.
- `app/slack/schema.sql`
  - Supabase schema for thread mapping, event dedupe, and status post dedupe.

## 2) DB/schema additions (Supabase)

Run `app/slack/schema.sql`.

Tables:
- `public.slack_task_threads`
  - `supabase_task_id` (PK)
  - `root_supabase_task_id`, `parent_supabase_task_id`
  - `local_task_id`
  - `team_id`, `channel_id`, `thread_ts`, `root_message_ts`
  - `latest_status`, `blocked_question`
  - `queued_at`, `blocked_at`, `completed_at`, `last_status_posted_at`
  - `created_at`, `updated_at`
- `public.slack_event_dedupe`
  - `event_id` (PK)
  - `team_id`, `event_type`, `received_at`
- `public.task_status_posts`
  - `id` (PK)
  - `idempotency_key` (UNIQUE)
  - `supabase_task_id`, `local_task_id`
  - `status`, `status_at`
  - `channel_id`, `thread_ts`
  - `payload_json`, `posted_message_ts`, `posted_at`, `created_at`

## 3) Endpoint contracts

### `POST /slack/commands`
Content-Type: `application/x-www-form-urlencoded` (Slack slash command payload)

Behavior:
- verifies Slack signature
- inserts task into `task_queue` with `status='queued'`
- posts root message in channel
- stores mapping in `slack_task_threads`

Response JSON (ephemeral):
```json
{
  "response_type": "ephemeral",
  "text": "Queued <task-id>. Updates will be posted in-thread."
}
```

### `POST /slack/events`
Content-Type: `application/json`

Input supports:
- `type=url_verification` => returns `{ "challenge": "..." }`
- `type=event_callback` + `event_id` + message events

Thread-reply behavior:
- verify signature
- dedupe via `slack_event_dedupe`
- locate mapping by `(channel_id, thread_ts)`
- if mapped local task exists and local input API is configured, append reply input
- otherwise create follow-up task in `task_queue` with `parent_task_id`
- keep mapping on same thread for child tasks

Response:
```json
{ "ok": true }
```

### `POST /task-status`
Headers:
- `x-automation-webhook-secret: <AUTOMATION_TASK_STATUS_WEBHOOK_SECRET>`

Body JSON:
```json
{
  "supabase_task_id": "uuid-optional-if-local-provided",
  "local_task_id": "optional",
  "status": "blocked|completed|in_progress|failed|...",
  "status_at": "2026-03-17T18:30:00Z",
  "idempotency_key": "optional-custom-key",
  "blocked_question": "single concrete question",
  "summary": "optional completion summary",
  "output_path": "optional path",
  "team_id": "optional fallback",
  "channel_id": "optional fallback",
  "thread_ts": "optional fallback"
}
```

Behavior:
- auth check
- resolve task + mapping
- dedupe status transition post (`task_status_posts`)
- post status update into mapped thread
- update mapping timestamps/status

Response:
```json
{ "ok": true }
```

## 4) Environment variables

Required:
- `AUTOMATION_SUPABASE_URL`
- `AUTOMATION_SUPABASE_SERVICE_ROLE_KEY`
- `AUTOMATION_SUPABASE_QUEUE_TABLE` (default: `task_queue`)
- `AUTOMATION_SLACK_BOT_TOKEN`
- `AUTOMATION_SLACK_VERIFY_SIGNATURE=1`
- `AUTOMATION_SLACK_SIGNING_SECRET`
- `AUTOMATION_TASK_STATUS_WEBHOOK_SECRET`

Optional (for direct resume of known local task):
- `AUTOMATION_LOCAL_TASK_API_BASE_URL` (example: `http://127.0.0.1:8787`)
- `AUTOMATION_LOCAL_TASK_API_BEARER_TOKEN`
- `AUTOMATION_LOCAL_TASK_API_SHARED_SECRET`
- `AUTOMATION_SLACK_REPLY_MODE` (`always_child` default, or `resume_then_child`)

## 5) Slack app configuration checklist

- Slash command
  - Command: `/autotask`
  - Request URL: `https://<public-webhook-host>/slack/commands`
- Event subscriptions
  - Enable events
  - Request URL: `https://<public-webhook-host>/slack/events`
  - Subscribe to bot events: `message.channels`, `message.groups`, `message.im` (choose only needed surfaces)
- OAuth scopes (bot)
  - `commands`
  - `chat:write`
  - `channels:history` (if public channels)
  - `groups:history` (if private channels)
  - `im:history` (if using DMs)
  - `app_mentions:read` (optional)
- Reinstall app after scope changes.

## 6) Sequence flows

### New task (`/autotask ...`)
1. Slack -> `/slack/commands`
2. Handler verifies signature.
3. Inserts row into `task_queue` (`status=queued`, `source_meta`).
4. Posts anchor message in channel.
5. Stores mapping `{supabase_task_id, channel_id, thread_ts, team_id}`.
6. Returns ephemeral ack.

### Blocked question
1. Local executor -> `/task-status` with `status=blocked` and `blocked_question`.
2. Handler auth + idempotency claim.
3. Posts `Blocked: <question>` in same thread.
4. Updates mapping `latest_status=blocked`, `blocked_at`.

### In-thread reply -> follow-up
1. User replies in thread.
2. Slack -> `/slack/events` message event with `thread_ts`.
3. Handler dedupes by `event_id`, finds mapped task by `(channel_id, thread_ts)`.
4. Attempts direct append to local task if `local_task_id` + local API configured.
5. If append unavailable/fails, enqueues child task with `parent_task_id` and maps child to same thread.
6. Posts acknowledgment in-thread.

### Completion
1. Local executor -> `/task-status` with `status=completed`, summary/output.
2. Handler dedupe claim + mapping lookup.
3. Posts concise completion update in same thread.
4. Updates mapping `completed_at`, `latest_status=completed`.

## 7) Minimal test plan

- Happy path
  - `/autotask` queues and creates root thread mapping.
  - `/task-status` blocked/completed posts to same thread.
  - in-thread reply creates follow-up child (or resumes local task when configured).
- Failure/edge cases
  - Duplicate Slack event (`event_id` replay) -> ignored.
  - Missing mapping on reply -> logged `reply_missing_mapping` and no crash.
  - Thread reply after stale/completed task -> child task still enqueued with parent, mapping preserved.
  - Slack API timeout/5xx -> retry with backoff and structured error log.
  - Duplicate `/task-status` transition -> dedupe via `idempotency_key`, no duplicate post.

## 8) Rollout plan

- Phase 1: command + queue + mapping
  - Deploy `schema.sql`, `/slack/commands`, and compatibility wrappers.
  - Verify root thread anchor and mapping rows.
- Phase 2: blocked/completion posting
  - Enable `/task-status` with shared secret.
  - Send synthetic blocked/completed payloads and verify in-thread posts.
- Phase 3: in-thread reply follow-up automation
  - Enable `/slack/events` message subscriptions.
  - Verify reply dedupe, local append (if configured), and child enqueue fallback.
