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
  hoveredNote,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  metrics: ChartMetric[];
  notes?: ChartNote[];
  hoveredNote?: ChartNote | null;
}) {
  if (!active || !payload?.length) return null;

  const metricMap = new Map(metrics.map((m) => [m.key, m]));
  const weekNotes = notes?.filter((n) => n.weekLabel === label) ?? [];
  const showNoteOnly = Boolean(hoveredNote && hoveredNote.weekLabel === label);

  if (showNoteOnly) {
    return (
      <div className="bg-white/95 border border-slate-200 rounded-lg px-3.5 py-3 shadow-xl text-[13px] max-w-[340px]">
        <div className="font-semibold text-slate-900 mb-1.5">{label}</div>
        {weekNotes.map((n, i) => (
          <div key={i} className="text-slate-600 text-[12px] leading-relaxed whitespace-pre-line">
            <span className="text-amber-400">{n.date}</span>: {n.text}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white/95 border border-slate-200 rounded-lg px-3.5 py-3 shadow-xl text-[13px] max-w-[340px]">
      <div className="font-semibold text-slate-900 mb-1.5">{label}</div>
      {payload.map((entry) => {
        const m = metricMap.get(entry.dataKey);
        if (!m || entry.value == null) return null;
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500 text-[12px]">{m.label}</span>
            </span>
            <span className="font-mono text-slate-900 text-[12px]">{fmt(m.formatType, entry.value)}</span>
          </div>
        );
      })}
      {weekNotes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-1">Notes</div>
          {weekNotes.map((n, i) => (
            <div key={i} className="text-slate-500 text-[12px] leading-relaxed whitespace-pre-line">
              {n.date}: {n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Note label rendered at top of reference line ───────────────────────────

function NoteMarker({
  viewBox,
  note,
  onHover,
}: {
  viewBox?: { x: number; y: number };
  note: ChartNote;
  onHover: (note: ChartNote | null) => void;
}) {
  if (!viewBox) return null;
  return (
    <g transform={`translate(${viewBox.x - 8}, 6)`}>
      <circle
        cx={8}
        cy={8}
        r={12}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => onHover(note)}
        onMouseLeave={() => onHover(null)}
      />
      <rect
        x={1}
        y={1}
        width={14}
        height={14}
        rx={3}
        fill="#ffffff"
        stroke="#F59E0B"
        strokeWidth={1.5}
        style={{ pointerEvents: 'none' }}
      />
      <text
        x={8}
        y={11}
        textAnchor="middle"
        fontSize={8}
        fontWeight={700}
        fill="#F59E0B"
        style={{ pointerEvents: 'none' }}
      >
        N
      </text>
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
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const [hoveredNote, setHoveredNote] = useState<ChartNote | null>(null);

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
          const isHovered = hoveredMetric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              onMouseEnter={() => setHoveredMetric(m.key)}
              onMouseLeave={() => setHoveredMetric(null)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.5px] border transition-all ${
                isOn
                  ? 'border-slate-300 text-slate-900'
                  : 'border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              style={isOn || isHovered ? { backgroundColor: `${m.color}15` } : undefined}
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(33, 64, 94, 0.08)" />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748B' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(33, 64, 94, 0.12)' }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={50}
          />

          {hasDollar && (
            <YAxis
              yAxisId="dollar"
              orientation="left"
              tick={{ fontSize: 10, fill: '#64748B' }}
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
              tick={{ fontSize: 10, fill: '#64748B' }}
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
            content={<ChartTooltip metrics={metrics} notes={notes} hoveredNote={hoveredNote} />}
            cursor={{ stroke: 'rgba(33, 64, 94, 0.12)' }}
          />

          {[...noteWeeks.values()].map((note) => (
            <ReferenceLine
              key={`note-${note.weekLabel}-${note.date}`}
              x={note.weekLabel}
              yAxisId={hasDollar ? 'dollar' : 'pct'}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={<NoteMarker note={note} onHover={setHoveredNote} />}
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
                strokeWidth={hoveredMetric === m.key ? 3 : 2}
                strokeOpacity={hoveredMetric && hoveredMetric !== m.key ? 0.2 : 1}
                dot={{ r: hoveredMetric === m.key ? 4 : 3, fill: m.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: m.color, strokeWidth: 2, stroke: '#ffffff' }}
                connectNulls
              />
            ) : null
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
