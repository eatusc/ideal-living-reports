'use client';

import { useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FormatType = 'dollar' | 'pct' | 'roas' | 'number';

export interface ChartMetric {
  key: string;
  label: string;
  color: string;
  yAxisId: 'dollar' | 'pct' | 'count';
  formatType: FormatType;
  defaultVisible?: boolean;
}

export interface ChartDataPoint {
  label: string;
  [key: string]: number | string | null;
}

export interface ChartNote {
  date: string;
  text: string;
  weekLabel: string;
}

interface TrendChartProps {
  data: ChartDataPoint[];
  metrics: ChartMetric[];
  notes?: ChartNote[];
  accentColor?: string;
  height?: number;
}

// ─── Format resolver ────────────────────────────────────────────────────────

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

// ─── Custom tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  metrics,
  notes,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  metrics: ChartMetric[];
  notes?: ChartNote[];
}) {
  if (!active || !payload?.length) return null;

  const metricMap = new Map(metrics.map((m) => [m.key, m]));
  const weekNotes = notes?.filter((n) => n.weekLabel === label) ?? [];

  return (
    <div className="bg-[#111827] border border-white/[0.12] rounded-lg px-3 py-2.5 shadow-xl text-[11px] max-w-[260px]">
      <div className="font-semibold text-white mb-1.5">{label}</div>
      {payload.map((entry) => {
        const m = metricMap.get(entry.dataKey);
        if (!m || entry.value == null) return null;
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-400">{m.label}</span>
            </span>
            <span className="font-mono text-white">{fmt(m.formatType, entry.value)}</span>
          </div>
        );
      })}
      {weekNotes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/[0.08]">
          <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-1">Notes</div>
          {weekNotes.map((n, i) => (
            <div key={i} className="text-gray-400 text-[10px] leading-relaxed whitespace-pre-line">
              {n.date}: {n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Note label rendered at top of reference line ───────────────────────────

function NoteMarker({ viewBox, note }: { viewBox?: { x: number; y: number }; note: ChartNote }) {
  if (!viewBox) return null;
  return (
    <g>
      <circle cx={viewBox.x} cy={8} r={4} fill="#F59E0B" />
      <title>{`${note.date}: ${note.text}`}</title>
    </g>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function TrendChart({
  data,
  metrics,
  notes = [],
  height = 360,
}: TrendChartProps) {
  const [visible, setVisible] = useState<Set<string>>(() => {
    const init = new Set<string>();
    metrics.forEach((m) => {
      if (m.defaultVisible !== false) init.add(m.key);
    });
    return init;
  });

  const toggle = useCallback((key: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const hasDollar = metrics.some((m) => m.yAxisId === 'dollar' && visible.has(m.key));
  const hasPct = metrics.some((m) => m.yAxisId === 'pct' && visible.has(m.key));
  const hasCount = metrics.some((m) => m.yAxisId === 'count' && visible.has(m.key));

  const noteWeeks = new Map<string, ChartNote>();
  notes.forEach((n) => {
    if (!noteWeeks.has(n.weekLabel)) noteWeeks.set(n.weekLabel, n);
  });

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg p-4">
      {/* Metric toggle pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {metrics.map((m) => {
          const isOn = visible.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.5px] border transition-all ${
                isOn
                  ? 'border-white/[0.15] text-white'
                  : 'border-white/[0.06] text-gray-600 hover:text-gray-400'
              }`}
              style={isOn ? { backgroundColor: `${m.color}15` } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isOn ? m.color : '#4B5563' }}
              />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={50}
          />

          {hasDollar && (
            <YAxis
              yAxisId="dollar"
              orientation="left"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => {
                if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
                return `$${v}`;
              }}
              width={55}
            />
          )}

          {(hasPct || hasCount) && (
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              width={45}
            />
          )}

          {hasCount && !hasPct && (
            <YAxis yAxisId="count" orientation="right" hide />
          )}

          <Tooltip
            content={<ChartTooltip metrics={metrics} notes={notes} />}
            cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
          />

          {[...noteWeeks.values()].map((note) => (
            <ReferenceLine
              key={`note-${note.weekLabel}-${note.date}`}
              x={note.weekLabel}
              yAxisId={hasDollar ? 'dollar' : 'pct'}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={<NoteMarker note={note} />}
            />
          ))}

          {metrics.map((m) =>
            visible.has(m.key) ? (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                yAxisId={m.yAxisId === 'count' && !hasPct ? 'count' : m.yAxisId === 'count' ? 'pct' : m.yAxisId}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 3, fill: m.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: m.color, strokeWidth: 2, stroke: '#111827' }}
                connectNulls
              />
            ) : null
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
