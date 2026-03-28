'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AcosGoal } from '@/lib/acosGoals';
import type { BrandSignal, SignalSeverity } from '@/lib/brandOps';
import {
  BRAND_CHANNELS,
  BRAND_LABELS,
  CHANNEL_LABELS,
  DEFAULT_ACOS_TARGET,
  type BrandKey,
  type ChannelKey,
} from '@/lib/brandOpsConfig';

interface BrandOpsBoardProps {
  initialGoals: AcosGoal[];
  signals: BrandSignal[];
  awareness: string[];
}

function severityTone(severity: SignalSeverity): string {
  if (severity === 'high') return 'bg-red-100 text-red-700 border-red-200';
  if (severity === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function severityRank(severity: SignalSeverity): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function toPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function keyFor(brandKey: BrandKey, channelKey: ChannelKey): string {
  return `${brandKey}|${channelKey}`;
}

function buildInitialGoalState(initialGoals: AcosGoal[]): Record<string, string> {
  const state: Record<string, string> = {};

  for (const [brandKey, channels] of Object.entries(BRAND_CHANNELS) as Array<[BrandKey, readonly ChannelKey[]]>) {
    for (const channelKey of channels) {
      state[keyFor(brandKey, channelKey)] = (DEFAULT_ACOS_TARGET * 100).toFixed(1);
    }
  }

  for (const goal of initialGoals) {
    state[keyFor(goal.brandKey, goal.channelKey)] = (goal.targetAcos * 100).toFixed(1);
  }
  return state;
}

export default function BrandOpsBoard({ initialGoals, signals, awareness }: BrandOpsBoardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>(() => buildInitialGoalState(initialGoals));
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => {
      if (brandFilter !== 'all' && signal.brandKey !== brandFilter) return false;
      if (channelFilter !== 'all' && signal.channelKey !== channelFilter) return false;
      if (severityFilter !== 'all' && signal.severity !== severityFilter) return false;
      return true;
    });
  }, [signals, brandFilter, channelFilter, severityFilter]);

  const prioritySignals = useMemo(() => {
    return [...filteredSignals]
      .sort((a, b) => {
        const sev = severityRank(b.severity) - severityRank(a.severity);
        if (sev !== 0) return sev;
        return a.brandLabel.localeCompare(b.brandLabel);
      });
  }, [filteredSignals]);

  const brandSummary = useMemo(() => {
    const summary = new Map<string, {
      high: number;
      medium: number;
      low: number;
      topAction: string;
      highlights: string[];
      watchItems: Array<{ id: string; issue: string; action: string; severity: SignalSeverity }>;
    }>();
    for (const signal of signals) {
      const prev = summary.get(signal.brandKey) ?? {
        high: 0,
        medium: 0,
        low: 0,
        topAction: signal.suggestedAction,
        highlights: [],
        watchItems: [],
      };
      if (signal.severity === 'high') prev.high += 1;
      else if (signal.severity === 'medium') prev.medium += 1;
      else prev.low += 1;
      if (!prev.topAction || signal.severity === 'high') prev.topAction = signal.suggestedAction;
      for (const highlight of signal.impactHighlights) {
        if (!prev.highlights.includes(highlight)) prev.highlights.push(highlight);
      }
      if (signal.severity === 'high' || signal.severity === 'medium') {
        const watchId = `${signal.issue}|${signal.suggestedAction}`;
        if (!prev.watchItems.some((item) => item.id === watchId)) {
          prev.watchItems.push({
            id: watchId,
            issue: signal.issue,
            action: signal.suggestedAction,
            severity: signal.severity,
          });
        }
      }
      summary.set(signal.brandKey, prev);
    }

    for (const item of summary.values()) {
      item.watchItems.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    }

    return summary;
  }, [signals]);

  async function saveGoal(brandKey: BrandKey, channelKey: ChannelKey) {
    const key = keyFor(brandKey, channelKey);
    const raw = goalInputs[key]?.trim() ?? '';
    const parsed = Number.parseFloat(raw);

    if (Number.isNaN(parsed)) {
      setSaveError(`Invalid percentage for ${BRAND_LABELS[brandKey]} / ${CHANNEL_LABELS[channelKey]}.`);
      return;
    }
    if (parsed < 0 || parsed > 200) {
      setSaveError('ACoS goal must be between 0% and 200%.');
      return;
    }

    setSaveError(null);
    setSavingKey(key);
    try {
      const res = await fetch('/api/acos-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandKey,
          channelKey,
          targetAcos: parsed / 100,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Failed to save goal');
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save goal';
      setSaveError(message);
    } finally {
      setSavingKey(null);
    }
  }

  const allChannels = useMemo(() => {
    return Array.from(new Set(signals.map((s) => s.channelKey))).sort();
  }, [signals]);

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-[12px] rounded ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-[12px] rounded ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100'}`}
          >
            Settings
          </button>
        </div>
      </section>

      {activeTab === 'settings' ? (
        <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[1px] text-slate-700 mb-3">ACoS Goal Settings</h2>
        <p className="text-[13px] text-slate-600 mb-4">
          Update target ACoS by brand and channel. Signal severity is recalculated against these targets.
        </p>
        {saveError && (
          <div className="mb-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.entries(BRAND_CHANNELS) as Array<[BrandKey, readonly ChannelKey[]]>).flatMap(([brandKey, channels]) =>
            channels.map((channelKey) => {
              const key = keyFor(brandKey, channelKey);
              const isSaving = savingKey === key;
              return (
                <div key={key} className="border border-slate-200 rounded p-3 bg-slate-50">
                  <div className="text-[12px] font-semibold text-slate-800 mb-1">{BRAND_LABELS[brandKey]}</div>
                  <div className="text-[12px] text-slate-600 mb-2">{CHANNEL_LABELS[channelKey]}</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={goalInputs[key] ?? (DEFAULT_ACOS_TARGET * 100).toFixed(1)}
                      onChange={(e) => setGoalInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-24 border border-slate-300 rounded px-2 py-1 text-[13px] font-mono bg-white"
                      inputMode="decimal"
                      aria-label={`${BRAND_LABELS[brandKey]} ${CHANNEL_LABELS[channelKey]} ACoS goal`}
                    />
                    <span className="text-[12px] text-slate-500">%</span>
                    <button
                      onClick={() => saveGoal(brandKey, channelKey)}
                      disabled={isSaving}
                      className="ml-auto px-2.5 py-1.5 text-[12px] rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
      ) : (
        <>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[1px] text-slate-700 mb-3">Priority Queue</h2>
        <div className="text-[12px] text-slate-500 mb-3">
          Showing {prioritySignals.length} item{prioritySignals.length === 1 ? '' : 's'} for current filters.
        </div>
        {prioritySignals.length === 0 ? (
          <div className="text-[13px] text-slate-500">No items for the current filters.</div>
        ) : (
          <div className="space-y-2">
            {prioritySignals.map((signal) => (
              <div key={signal.id} className="border border-slate-200 rounded p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[11px] uppercase tracking-[0.8px] border px-2 py-0.5 rounded ${severityTone(signal.severity)}`}>
                    {signal.severity}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-800">{signal.brandLabel}</span>
                  <span className="text-[12px] text-slate-500">/ {signal.channelLabel}</span>
                </div>
                <div className="text-[13px] text-slate-800 mb-1">
                  <strong>{signal.issue}</strong> - {signal.currentValue} ({signal.delta})
                </div>
                <div className="text-[12px] text-slate-700 mb-1">
                  Cost vs revenue: Spend <span className="font-mono">{fmtCurrency(signal.adSpend)}</span>
                  {' '}| Ad Revenue <span className="font-mono">{fmtCurrency(signal.adRevenue)}</span>
                  {' '}| Total Revenue <span className="font-mono">{fmtCurrency(signal.totalRevenue)}</span>
                </div>
                {signal.impactHighlights.length > 0 && (
                  <div className="text-[12px] text-slate-600 mb-1">
                    Impact drivers: {signal.impactHighlights.slice(0, 2).join(' ')}
                  </div>
                )}
                <div className="text-[12px] text-slate-600 mb-1">Action: {signal.suggestedAction}</div>
                <div className="text-[12px] text-slate-500">
                  <Link href={signal.sourcePage} className="text-blue-700 hover:text-blue-900">
                    Open source report
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[1px] text-slate-700 mb-3">Brand Snapshots</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(Object.entries(BRAND_LABELS) as Array<[BrandKey, string]>).map(([brandKey, brandLabel]) => {
            const item = brandSummary.get(brandKey) ?? {
              high: 0,
              medium: 0,
              low: 0,
              topAction: 'No active signal.',
              highlights: [],
              watchItems: [],
            };
            return (
              <div key={brandKey} className="border border-slate-200 rounded p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[13px] font-semibold text-slate-800">{brandLabel}</div>
                  <Link
                    href={signals.find((s) => s.brandKey === brandKey)?.sourcePage ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-blue-700 hover:text-blue-900"
                  >
                    Open
                  </Link>
                </div>
                <div className="text-[12px] text-slate-700 mb-1">High: {item.high}</div>
                <div className="text-[12px] text-slate-700 mb-1">Medium: {item.medium}</div>
                <div className="text-[12px] text-slate-700 mb-2">Low: {item.low}</div>
                <div className="text-[12px] text-slate-600">Top action: {item.topAction}</div>
                <div className="mt-2 text-[12px] font-semibold text-red-700">🔴 Watch / Action Required</div>
                {item.watchItems.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-[12px] text-slate-700">
                    {item.watchItems.slice(0, 3).map((watch) => (
                      <li key={watch.id}>
                        <span className="font-medium">{watch.issue}:</span> {watch.action}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-[12px] text-slate-500">No high/medium watch items right now.</div>
                )}
                <div className="mt-2 text-[12px] text-slate-700 font-medium">What is impacting ACoS:</div>
                {item.highlights.length > 0 ? (
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-[12px] text-slate-600">
                    {item.highlights.slice(0, 3).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-[12px] text-slate-500">
                    No campaign/term/SKU-level highlights available from this source file.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-[13px] font-bold uppercase tracking-[1px] text-slate-700">All Signals</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-[12px] bg-white">
              <option value="all">All brands</option>
              {(Object.entries(BRAND_LABELS) as Array<[BrandKey, string]>).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-[12px] bg-white">
              <option value="all">All channels</option>
              {allChannels.map((key) => (
                <option key={key} value={key}>{CHANNEL_LABELS[key]}</option>
              ))}
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-[12px] bg-white">
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[12px]">
            <thead className="text-[11px] uppercase tracking-[0.8px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-3">Brand</th>
                <th className="py-2 pr-3">Channel</th>
                <th className="py-2 pr-3">Issue</th>
                <th className="py-2 pr-3">Metric</th>
                <th className="py-2 pr-3">Current</th>
                <th className="py-2 pr-3">Previous</th>
                <th className="py-2 pr-3">Delta</th>
                <th className="py-2 pr-3">Severity</th>
                <th className="py-2 pr-3">Suggested Action</th>
                <th className="py-2 pr-3">Why It Matters</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map((signal) => (
                <tr key={signal.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-800">
                    <Link href={signal.sourcePage} className="text-blue-700 hover:text-blue-900">
                      {signal.brandLabel}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{signal.channelLabel}</td>
                  <td className="py-2 pr-3 text-slate-800">{signal.issue}</td>
                  <td className="py-2 pr-3 text-slate-700">{signal.metric}</td>
                  <td className="py-2 pr-3 text-slate-700">{signal.currentValue}</td>
                  <td className="py-2 pr-3 text-slate-700">{signal.previousValue}</td>
                  <td className="py-2 pr-3 text-slate-700">{signal.delta}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-[10px] uppercase tracking-[0.8px] border px-1.5 py-0.5 rounded ${severityTone(signal.severity)}`}>
                      {signal.severity}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{signal.suggestedAction}</td>
                  <td className="py-2 pr-3 text-slate-600">{signal.whyItMatters}</td>
                </tr>
              ))}
              {filteredSignals.length === 0 && (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={10}>No signals match current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[1px] text-slate-700 mb-3">Awareness Notes</h2>
        {awareness.length === 0 ? (
          <div className="text-[13px] text-slate-500">No parser warnings detected.</div>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-[13px] text-slate-700">
            {awareness.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-[12px] text-slate-500">Goal baseline example: {toPct(DEFAULT_ACOS_TARGET)}</div>
      </section>
        </>
      )}
    </div>
  );
}
