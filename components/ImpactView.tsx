'use client';

import { type ChartDataPoint, type ChartNote, type ChartMetric, type FormatType } from './TrendChart';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImpactViewProps {
  data: ChartDataPoint[];
  metrics: ChartMetric[];
  notes: ChartNote[];
  accentColor?: string;
  /** Max trailing weeks to show after a change (default 4) */
  maxTrailingWeeks?: number;
}

interface WeekGroup {
  weekLabel: string;
  weekIndex: number;
  notes: ChartNote[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Metrics where going DOWN is good */
const INVERT_GOOD = new Set(['acos', 'adSpend']);

function fmt(type: FormatType, val: number): string {
  switch (type) {
    case 'dollar':
      if (val < 0) return `-$${Math.abs(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'pct':
      return `${val.toFixed(1)}%`;
    case 'roas':
      return `${val.toFixed(2)}x`;
    case 'number':
      return Math.round(val).toLocaleString('en-US');
  }
}

function deltaLabel(baseline: number, current: number, type: FormatType): string {
  if (baseline === 0 && current === 0) return '—';
  if (type === 'pct') {
    const diff = current - baseline;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}`;
  }
  if (baseline === 0) return current > 0 ? '+∞' : '—';
  const pctChange = ((current - baseline) / Math.abs(baseline)) * 100;
  const sign = pctChange >= 0 ? '+' : '';
  return `${sign}${pctChange.toFixed(1)}%`;
}

function deltaColor(baseline: number, current: number, metricKey: string): string {
  if (baseline === 0 && current === 0) return 'text-gray-500';
  const diff = current - baseline;
  if (diff === 0) return 'text-gray-400';
  const invert = INVERT_GOOD.has(metricKey);
  const isGood = invert ? diff < 0 : diff > 0;
  return isGood ? 'text-green-400' : 'text-red-400';
}

function deltaArrow(baseline: number, current: number): string {
  if (current > baseline) return '▲';
  if (current < baseline) return '▼';
  return '—';
}

/** Is a metric change "good"? */
function isGoodDelta(baseline: number, current: number, metricKey: string): boolean {
  const diff = current - baseline;
  if (diff === 0) return false;
  return INVERT_GOOD.has(metricKey) ? diff < 0 : diff > 0;
}

/** Generate a plain-English summary from the last trailing week vs baseline */
function buildSummary(
  displayMetrics: ChartMetric[],
  baselineRow: ChartDataPoint,
  lastTrailingRow: ChartDataPoint,
  trailingCount: number,
): { text: string; verdict: 'positive' | 'negative' | 'mixed' | 'neutral' } {
  const parts: string[] = [];
  let goodCount = 0;
  let badCount = 0;

  for (const m of displayMetrics) {
    const baseVal = (baselineRow[m.key] as number) ?? 0;
    const lastVal = (lastTrailingRow[m.key] as number) ?? 0;
    if (baseVal === 0 && lastVal === 0) continue;

    const good = isGoodDelta(baseVal, lastVal, m.key);
    const diff = lastVal - baseVal;
    if (diff === 0) continue;

    if (good) goodCount++;
    else badCount++;

    // Build short description
    if (m.formatType === 'pct') {
      const sign = diff >= 0 ? '+' : '';
      parts.push(`${m.label} ${sign}${diff.toFixed(1)} pts`);
    } else if (baseVal !== 0) {
      const pctChange = ((lastVal - baseVal) / Math.abs(baseVal)) * 100;
      const sign = pctChange >= 0 ? '+' : '';
      parts.push(`${m.label} ${sign}${pctChange.toFixed(0)}%`);
    }
  }

  if (parts.length === 0) {
    return { text: 'No measurable change yet.', verdict: 'neutral' };
  }

  const weekLabel = trailingCount === 1 ? '1 week' : `${trailingCount} weeks`;
  let verdict: 'positive' | 'negative' | 'mixed' | 'neutral';
  if (goodCount > 0 && badCount === 0) verdict = 'positive';
  else if (badCount > 0 && goodCount === 0) verdict = 'negative';
  else verdict = 'mixed';

  const text = `Over ${weekLabel}: ${parts.join(' · ')}`;
  return { text, verdict };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ImpactView({
  data,
  metrics,
  notes,
  accentColor = '#FFC220',
  maxTrailingWeeks = 4,
}: ImpactViewProps) {
  if (notes.length === 0) {
    return (
      <div className="bg-dash-card border border-white/[0.08] rounded-lg p-8 text-center">
        <div className="text-gray-500 text-[13px] mb-1">No campaign changes logged yet.</div>
        <div className="text-gray-600 text-[11px]">Add notes in the Campaign Notes section below to track optimization impact here.</div>
      </div>
    );
  }

  // Group notes by their week label
  const weekMap = new Map<string, ChartNote[]>();
  for (const n of notes) {
    const existing = weekMap.get(n.weekLabel) ?? [];
    existing.push(n);
    weekMap.set(n.weekLabel, existing);
  }

  // Build ordered week groups with their index in the data array
  const weekGroups: WeekGroup[] = [];
  for (const [weekLabel, weekNotes] of weekMap) {
    const idx = data.findIndex((d) => d.label === weekLabel);
    if (idx >= 0) {
      weekGroups.push({ weekLabel, weekIndex: idx, notes: weekNotes });
    }
  }

  // Sort newest first so clients see the most recent impact at the top
  weekGroups.sort((a, b) => b.weekIndex - a.weekIndex);

  // Build a set of week indices that have changes (for overlap warnings)
  const changeWeekIndices = new Set(weekGroups.map((g) => g.weekIndex));

  // Pick a subset of metrics to show — prefer the ones marked defaultVisible, limit to 5
  const displayMetrics = metrics
    .filter((m) => m.defaultVisible !== false)
    .slice(0, 5);

  if (displayMetrics.length === 0) return null;

  return (
    <div className="space-y-4">
      {weekGroups.map((group) => {
        const baselineRow = data[group.weekIndex];
        // Trailing weeks: data rows after the baseline
        const trailingCount = Math.min(maxTrailingWeeks, data.length - 1 - group.weekIndex);
        const trailingWeeks = Array.from({ length: trailingCount }, (_, i) => ({
          offset: i + 1,
          row: data[group.weekIndex + i + 1],
          weekIndex: group.weekIndex + i + 1,
        }));

        const isRecent = trailingCount === 0;

        // Check for overlapping changes in the trailing period
        const overlappingWeeks = trailingWeeks.filter(
          (tw) => changeWeekIndices.has(tw.weekIndex)
        );

        // Build auto-generated summary from the last trailing week
        const lastTrailing = trailingWeeks[trailingWeeks.length - 1];
        const summary = lastTrailing
          ? buildSummary(displayMetrics, baselineRow, lastTrailing.row, trailingCount)
          : null;

        const verdictStyles = {
          positive: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', label: 'Net Positive' },
          negative: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', label: 'Net Negative' },
          mixed: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', label: 'Mixed Results' },
          neutral: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400', label: 'No Change' },
        };

        return (
          <div
            key={group.weekLabel}
            className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden"
          >
            {/* Header: week + note count */}
            <div
              className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between"
              style={{ borderLeft: `3px solid ${accentColor}` }}
            >
              <div>
                <div className="text-[13px] font-semibold text-white">
                  Week of {group.weekLabel}
                </div>
                {isRecent && (
                  <div className="text-[10px] text-amber-400 font-medium uppercase tracking-wide mt-0.5">
                    Monitoring...
                  </div>
                )}
              </div>
              <div
                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                {group.notes.length} change{group.notes.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Auto-generated summary */}
            {summary && (
              <div className={`px-4 py-2.5 border-b border-white/[0.08] flex items-center gap-3 ${verdictStyles[summary.verdict].bg}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${verdictStyles[summary.verdict].border} ${verdictStyles[summary.verdict].text}`}>
                  {verdictStyles[summary.verdict].label}
                </span>
                <span className="text-[11px] text-[#C8D5E8]">{summary.text}</span>
              </div>
            )}

            {/* Notes list */}
            <div className="px-4 py-3 border-b border-white/[0.08] bg-white/[0.01]">
              <ul className="space-y-1.5">
                {group.notes.map((n, i) => (
                  <li key={i} className="flex gap-2 items-start text-[12px]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
                    <div>
                      <span className="text-gray-400 font-mono text-[11px]">{n.date}</span>
                      <span className="text-gray-500 mx-1.5">—</span>
                      <span className="text-[#C8D5E8] whitespace-pre-line">{n.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Overlap warning */}
            {overlappingWeeks.length > 0 && (
              <div className="px-4 py-2 border-b border-white/[0.08] bg-amber-500/[0.04] flex items-center gap-2">
                <span className="text-amber-400 text-[11px]">⚠</span>
                <span className="text-[10px] text-amber-400/80">
                  Additional changes were made during Wk {overlappingWeeks.map((w) => w.offset).join(', Wk ')} of this trailing period — results may reflect combined impact.
                </span>
              </div>
            )}

            {/* Impact data table */}
            {trailingCount > 0 ? (
              <div className="table-scroll">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-dash-card2 border-b border-white/[0.08]">
                      <th className="text-left px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">
                        Metric
                      </th>
                      <th className="text-right px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">
                        Baseline
                      </th>
                      {trailingWeeks.map((tw) => (
                        <th
                          key={tw.offset}
                          className="text-right px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap"
                        >
                          Wk {tw.offset}
                          {changeWeekIndices.has(tw.weekIndex) && (
                            <span className="ml-1 text-amber-400" title="Additional changes made this week">*</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayMetrics.map((m) => {
                      const baseVal = (baselineRow[m.key] as number) ?? 0;

                      return (
                        <tr
                          key={m.key}
                          className="border-b border-white/[0.05] last:border-0"
                        >
                          <td className="px-3.5 py-2.5 text-[12px] font-medium text-white whitespace-nowrap">
                            <span className="inline-block w-2 h-2 rounded-full mr-2 -translate-y-px" style={{ backgroundColor: m.color }} />
                            {m.label}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-gray-400 whitespace-nowrap">
                            {fmt(m.formatType, baseVal)}
                          </td>
                          {trailingWeeks.map((tw) => {
                            const val = (tw.row[m.key] as number) ?? 0;
                            const arrow = deltaArrow(baseVal, val);
                            const color = deltaColor(baseVal, val, m.key);
                            const delta = deltaLabel(baseVal, val, m.formatType);

                            return (
                              <td key={tw.offset} className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                <div className="font-mono text-[#E8EDF5]">
                                  {fmt(m.formatType, val)}
                                </div>
                                <div className={`font-mono text-[10px] mt-0.5 ${color}`}>
                                  {arrow} {delta}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-4 text-[12px] text-gray-500">
                Impact data will appear here after the next weekly data upload.
              </div>
            )}

            {/* Week labels footer */}
            {trailingCount > 0 && (
              <div className="px-4 py-2 border-t border-white/[0.05] text-[10px] text-gray-600 flex gap-4">
                <span><strong className="text-gray-500">Baseline:</strong> {baselineRow.label}</span>
                {trailingWeeks.length > 0 && (
                  <span>
                    <strong className="text-gray-500">Wk {trailingWeeks.length}:</strong>{' '}
                    {trailingWeeks[trailingWeeks.length - 1].row.label}
                  </span>
                )}
                <span className="ml-auto text-gray-600">All deltas vs. baseline</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
