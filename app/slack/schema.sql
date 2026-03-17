-- Slack in-thread mapping schema for webhook edge server.
-- Run in Supabase SQL editor with a service role context.

create extension if not exists pgcrypto;

create table if not exists public.slack_task_threads (
  supabase_task_id uuid primary key,
  root_supabase_task_id uuid not null,
  parent_supabase_task_id uuid null,
  local_task_id text null,
  team_id text not null,
  channel_id text not null,
  thread_ts text not null,
  root_message_ts text not null,
  latest_status text null,
  blocked_question text null,
  queued_at timestamptz null,
  blocked_at timestamptz null,
  completed_at timestamptz null,
  last_status_posted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_slack_task_threads_thread
  on public.slack_task_threads (channel_id, thread_ts, updated_at desc);

create index if not exists idx_slack_task_threads_local_task
  on public.slack_task_threads (local_task_id)
  where local_task_id is not null;

create table if not exists public.slack_event_dedupe (
  event_id text primary key,
  team_id text null,
  event_type text null,
  received_at timestamptz not null default now()
);

create table if not exists public.task_status_posts (
  id bigserial primary key,
  idempotency_key text not null unique,
  supabase_task_id uuid not null,
  local_task_id text null,
  status text not null,
  status_at timestamptz not null,
  channel_id text not null,
  thread_ts text not null,
  payload_json jsonb null,
  posted_message_ts text null,
  posted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_status_posts_task_time
  on public.task_status_posts (supabase_task_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_slack_task_threads_updated_at on public.slack_task_threads;
create trigger trg_slack_task_threads_updated_at
before update on public.slack_task_threads
for each row
execute function public.set_updated_at();
