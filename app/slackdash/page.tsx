import Link from 'next/link';
import { getQueueTable, getSupabaseAdmin, type SlackTaskThreadRow } from '@/lib/slackAutomation';

type QueueTaskRow = {
  id: string;
  status: string | null;
  prompt: string | null;
  local_task_id: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type PageData = {
  queueTasks: QueueTaskRow[];
  threadRows: SlackTaskThreadRow[];
  queueError: string | null;
  threadError: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusTone(status: string | null): string {
  const value = (status ?? '').toLowerCase();
  if (value === 'completed' || value === 'complete') return 'text-emerald-300';
  if (value === 'blocked' || value === 'blocked_on_user') return 'text-amber-300';
  if (value === 'failed' || value === 'error') return 'text-rose-300';
  return 'text-sky-300';
}

async function loadData(): Promise<PageData> {
  const supabaseUrl = process.env.AUTOMATION_SUPABASE_URL;
  const supabaseKey = process.env.AUTOMATION_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return {
      queueTasks: [],
      threadRows: [],
      queueError: 'Missing AUTOMATION_SUPABASE_URL or AUTOMATION_SUPABASE_SERVICE_ROLE_KEY.',
      threadError: 'Missing AUTOMATION_SUPABASE_URL or AUTOMATION_SUPABASE_SERVICE_ROLE_KEY.',
    };
  }

  const supabase = getSupabaseAdmin();
  const queueTable = getQueueTable();

  const [queueRes, threadRes] = await Promise.all([
    supabase
      .from(queueTable)
      .select('id,status,prompt,local_task_id,updated_at,created_at')
      .order('updated_at', { ascending: false })
      .limit(25),
    supabase
      .from('slack_task_threads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(25),
  ]);

  return {
    queueTasks: (queueRes.data as QueueTaskRow[] | null) ?? [],
    threadRows: (threadRes.data as SlackTaskThreadRow[] | null) ?? [],
    queueError: queueRes.error?.message ?? null,
    threadError: threadRes.error?.message ?? null,
  };
}

export const dynamic = 'force-dynamic';

export default async function SlackDashPage() {
  const data = await loadData();

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Slack Task Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              Live view of Slack thread mappings and recent Supabase queue tasks.
            </p>
          </div>
          <Link href="/" className="text-sm text-sky-300 hover:text-sky-200">
            Back to Home
          </Link>
        </header>

        <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Queue Tasks</h2>
            <span className="text-xs text-slate-400">{data.queueTasks.length} shown</span>
          </div>
          {data.queueError ? (
            <p className="text-sm text-rose-300">Queue query failed: {data.queueError}</p>
          ) : data.queueTasks.length === 0 ? (
            <p className="text-sm text-slate-400">No queue rows found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 pr-4">Task ID</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Local Task</th>
                    <th className="pb-2 pr-4">Updated</th>
                    <th className="pb-2">Prompt</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {data.queueTasks.map((task) => (
                    <tr key={task.id} className="border-t border-white/5">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-200">{task.id}</td>
                      <td className={`py-2 pr-4 font-medium ${statusTone(task.status)}`}>
                        {task.status ?? 'n/a'}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-300">
                        {task.local_task_id ?? 'n/a'}
                      </td>
                      <td className="py-2 pr-4 text-slate-300">{formatDateTime(task.updated_at)}</td>
                      <td className="py-2 text-slate-300">
                        {(task.prompt ?? '').slice(0, 140) || 'n/a'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Slack Thread Mappings</h2>
            <span className="text-xs text-slate-400">{data.threadRows.length} shown</span>
          </div>
          {data.threadError ? (
            <p className="text-sm text-rose-300">Thread query failed: {data.threadError}</p>
          ) : data.threadRows.length === 0 ? (
            <p className="text-sm text-slate-400">No thread mappings found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 pr-4">Supabase Task</th>
                    <th className="pb-2 pr-4">Latest Status</th>
                    <th className="pb-2 pr-4">Channel</th>
                    <th className="pb-2 pr-4">Thread TS</th>
                    <th className="pb-2 pr-4">Updated</th>
                    <th className="pb-2">Blocked Question</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {data.threadRows.map((row) => (
                    <tr key={row.supabase_task_id} className="border-t border-white/5">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-200">
                        {row.supabase_task_id}
                      </td>
                      <td className={`py-2 pr-4 font-medium ${statusTone(row.latest_status)}`}>
                        {row.latest_status ?? 'n/a'}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-300">{row.channel_id}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-300">{row.thread_ts}</td>
                      <td className="py-2 pr-4 text-slate-300">{formatDateTime(row.updated_at)}</td>
                      <td className="py-2 text-slate-300">{row.blocked_question ?? 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
