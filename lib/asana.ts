export interface AsanaTaskSummary {
  gid: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  dueOn: string | null;
  assigneeName: string | null;
  permalinkUrl: string | null;
}

export interface AsanaTaskComment {
  gid: string;
  text: string;
  createdAt: string | null;
  createdByName: string | null;
  attachments: AsanaTaskAttachment[];
}

export interface AsanaTaskBundle {
  task: AsanaTaskSummary;
  comments: AsanaTaskComment[];
}

export interface AsanaTaskAttachment {
  gid: string;
  name: string;
  createdAt: string | null;
  createdByName: string | null;
  downloadUrl: string | null;
  permanentUrl: string | null;
  resourceSubtype: string | null;
}

interface AsanaEnvelope<T> {
  data: T;
}

interface AsanaTaskApi {
  gid: string;
  name: string;
  completed: boolean;
  completed_at: string | null;
  due_on: string | null;
  permalink_url: string | null;
  assignee: { name: string } | null;
}

interface AsanaStoryApi {
  gid: string;
  text: string;
  created_at: string | null;
  resource_subtype?: string;
  type?: string;
  created_by?: { name: string } | null;
}

interface AsanaAttachmentApi {
  gid: string;
  name: string;
  created_at: string | null;
  download_url: string | null;
  permanent_url: string | null;
  resource_subtype?: string | null;
  created_by?: { name: string } | null;
}

const ASANA_BASE = 'https://app.asana.com/api/1.0';

function getAuthToken(): string {
  const token = process.env.ASANA_PAT;
  if (!token) throw new Error('ASANA_PAT is not configured');
  return token;
}

async function asanaGet<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${ASANA_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Asana API ${response.status}: ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as AsanaEnvelope<T>;
  return json.data;
}

export async function fetchAsanaTaskBundle(taskGid: string): Promise<AsanaTaskBundle> {
  const [task, stories, attachments] = await Promise.all([
    asanaGet<AsanaTaskApi>(
      `/tasks/${taskGid}?opt_fields=gid,name,completed,completed_at,due_on,assignee.name,permalink_url`,
    ),
    asanaGet<AsanaStoryApi[]>(
      `/tasks/${taskGid}/stories?opt_fields=gid,text,created_at,resource_subtype,type,created_by.name`,
    ),
    asanaGet<AsanaAttachmentApi[]>(
      `/tasks/${taskGid}/attachments?opt_fields=gid,name,created_at,download_url,permanent_url,resource_subtype,created_by.name`,
    ),
  ]);

  const latestComments = stories
    .filter((s) => s.resource_subtype === 'comment_added' || s.type === 'comment')
    .map((s) => ({
      gid: s.gid,
      text: s.text ?? '',
      createdAt: s.created_at ?? null,
      createdByName: s.created_by?.name ?? null,
      attachments: [] as AsanaTaskAttachment[],
    }))
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, 10);

  const mappedAttachments = attachments
    .map((a) => ({
      gid: a.gid,
      name: a.name,
      createdAt: a.created_at ?? null,
      downloadUrl: a.download_url ?? null,
      permanentUrl: a.permanent_url ?? null,
      resourceSubtype: a.resource_subtype ?? null,
      createdByName: a.created_by?.name ?? null,
    }))
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });

  // Correlate attachments to the latest comments using author + time proximity.
  // This keeps image count aligned with visible comments instead of showing all task files.
  const comments = latestComments.map((c) => ({ ...c, attachments: [] as AsanaTaskAttachment[] }));
  const windowMs = 45 * 60 * 1000;
  for (const attachment of mappedAttachments) {
    const at = attachment.createdAt ? new Date(attachment.createdAt).getTime() : NaN;
    if (!isFinite(at)) continue;

    let winnerIdx = -1;
    let winnerDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < comments.length; i += 1) {
      const c = comments[i];
      const ct = c.createdAt ? new Date(c.createdAt).getTime() : NaN;
      if (!isFinite(ct)) continue;

      const delta = Math.abs(at - ct);
      if (delta > windowMs) continue;

      const sameAuthor =
        !attachment.createdByName ||
        !c.createdByName ||
        attachment.createdByName.toLowerCase() === c.createdByName.toLowerCase();
      if (!sameAuthor) continue;

      if (delta < winnerDelta) {
        winnerDelta = delta;
        winnerIdx = i;
      }
    }

    if (winnerIdx >= 0) {
      comments[winnerIdx].attachments.push(attachment);
    }
  }

  for (const c of comments) {
    c.attachments.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt;
    });
  }

  return {
    task: {
      gid: task.gid,
      name: task.name,
      completed: task.completed,
      completedAt: task.completed_at ?? null,
      dueOn: task.due_on ?? null,
      assigneeName: task.assignee?.name ?? null,
      permalinkUrl: task.permalink_url ?? null,
    },
    comments,
  };
}
