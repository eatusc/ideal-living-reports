'use client';

import { useState } from 'react';
import type { AsanaTaskBundle } from '@/lib/asana';

interface AsanaReportsSectionProps {
  data: AsanaTaskBundle | null;
  error?: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isImageAttachment(name: string, subtype: string | null): boolean {
  if (subtype && subtype.toLowerCase().includes('image')) return true;
  const n = name.toLowerCase();
  return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.gif') || n.endsWith('.webp');
}

export default function AsanaReportsSection({ data, error = null }: AsanaReportsSectionProps) {
  const [tab, setTab] = useState<'dashboard' | 'asana'>('dashboard');
  const [activeImage, setActiveImage] = useState<{ src: string; name: string } | null>(null);

  return (
    <section className="mt-9">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab('dashboard')}
          className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.8px] transition-colors ${
            tab === 'dashboard'
              ? 'bg-slate-200 text-slate-900'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => setTab('asana')}
          className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.8px] transition-colors ${
            tab === 'asana'
              ? 'bg-amber-100 text-amber-800'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Asana Reports
        </button>
      </div>

      {tab === 'dashboard' ? (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-[13px] text-slate-600">
          Performance dashboard is shown in the sections above. Switch to <strong>Asana Reports</strong> to view linked task details and comments.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="text-[11px] font-bold uppercase tracking-[1px] text-amber-700">Asana Reports</div>
          </div>

          {error ? (
            <div className="px-4 py-4 text-[13px] text-red-700">{error}</div>
          ) : !data ? (
            <div className="px-4 py-4 text-[13px] text-slate-500">No Asana task configured.</div>
          ) : (
            <div className="p-4 space-y-5">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="text-[10px] uppercase tracking-[0.8px] text-slate-500 mb-1">Task</div>
                <div className="text-[16px] font-semibold text-slate-900">{data.task.name}</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
                  <div><span className="text-slate-500">Status:</span> <span className="text-slate-900">{data.task.completed ? 'Completed' : 'Open'}</span></div>
                  <div><span className="text-slate-500">Assignee:</span> <span className="text-slate-900">{data.task.assigneeName ?? '—'}</span></div>
                  <div><span className="text-slate-500">Due:</span> <span className="text-slate-900">{formatDate(data.task.dueOn)}</span></div>
                </div>
                {data.task.permalinkUrl && (
                  <a
                    href={data.task.permalinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-3 text-[12px] font-medium text-blue-700 hover:text-blue-900"
                  >
                    Open in Asana
                  </a>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.8px] text-slate-500 mb-2">
                  Comments (Latest {data.comments.length})
                </div>
                {data.comments.length === 0 ? (
                  <div className="text-[13px] text-slate-500">No comments on this task yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {data.comments.map((c) => (
                      <li key={c.gid} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500 mb-1">
                          {c.createdByName ?? 'Unknown'} · {formatDate(c.createdAt)}
                        </div>
                        <div className="text-[13px] text-slate-700 whitespace-pre-line">
                          {c.text || '—'}
                        </div>
                        {c.attachments.length > 0 && (
                          <div className="mt-3 border-t border-slate-200 pt-3 space-y-2">
                            <div className="text-[10px] uppercase tracking-[0.8px] text-slate-500">
                              Attachments ({c.attachments.length})
                            </div>
                            <div className="space-y-2">
                              {c.attachments
                                .filter((a) => isImageAttachment(a.name, a.resourceSubtype))
                                .map((a) => {
                                  const href = a.downloadUrl ?? a.permanentUrl;
                                  if (!href) return null;
                                  return (
                                    <button
                                      type="button"
                                      key={a.gid}
                                      onClick={() => setActiveImage({ src: href, name: a.name })}
                                      className="block rounded-md border border-slate-200 overflow-hidden bg-white hover:border-slate-300 transition-colors"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={href}
                                        alt={a.name}
                                        className="w-full h-auto object-contain bg-slate-100"
                                        loading="lazy"
                                      />
                                      <div className="px-2.5 py-2 text-[11px] text-slate-700">
                                        {a.name}
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>

                            {c.attachments.some((a) => !isImageAttachment(a.name, a.resourceSubtype)) && (
                              <ul className="space-y-1">
                                {c.attachments
                                  .filter((a) => !isImageAttachment(a.name, a.resourceSubtype))
                                  .map((a) => {
                                    const href = a.downloadUrl ?? a.permanentUrl;
                                    return (
                                      <li key={a.gid} className="text-[11px] text-slate-700">
                                        {href ? (
                                          <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 hover:text-blue-900">
                                            {a.name}
                                          </a>
                                        ) : (
                                          <span>{a.name}</span>
                                        )}
                                      </li>
                                    );
                                  })}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4 sm:p-8 flex items-center justify-center"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="w-full max-w-[1400px] max-h-[92vh] rounded-lg overflow-hidden bg-black relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute top-2 right-2 z-10 px-2.5 py-1.5 rounded bg-white/90 text-slate-900 text-[12px] font-semibold"
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.src}
              alt={activeImage.name}
              className="w-full h-full max-h-[92vh] object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}
