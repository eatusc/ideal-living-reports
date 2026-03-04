// Client-safe utility functions and types — no server-side imports (fs, xlsx, blob)
// Used by both server parsers and client components.

// ─── RPD Walmart types ──────────────────────────────────────────────────────

export interface BrandData {
  brand: string;
  sales: number;
  units: number;
  orderedItems: number;
  adSpend: number;
  adUnitSales: number;
  adSales: number;
  acos: number | null;
  roas: number | null;
  organicSales: number;
}

export interface WeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orderedItems: number;
  adSpend: number;
  adSales: number;
  acos: number | null;
  roas: number | null;
  organicSales: number;
  brands: BrandData[];
}

export interface DashboardData {
  weeks: WeekData[];
  currentWeek: WeekData;
  previousWeek: WeekData;
}

export interface SemCampaignData {
  campaign: string;
  displayName: string;
  adSpend: number;
  adSales: number;
  acos: number | null;
  roas: number | null;
  impressions: number;
}

export interface SemWeekData {
  adSpend: number;
  adSales: number;
  acos: number | null;
  roas: number | null;
  impressions: number;
  campaigns: SemCampaignData[];
}

export interface SemDashboardData {
  currentWeek: SemWeekData;
  previousWeek: SemWeekData;
}

// ─── RPD Home Depot types ───────────────────────────────────────────────────

export interface RpdHdCampaignGroupData {
  group: string;
  sales: number;
  units: number;
  orderedItems: number;
  adSpend: number;
  adSales: number;
  adUnitSales: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
  organicSales: number;
}

export interface RpdHdWeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orderedItems: number;
  adSpend: number;
  adSales: number;
  acos: number | null;
  roas: number | null;
  organicSales: number;
  groups: RpdHdCampaignGroupData[];
}

// ─── Elevate types ──────────────────────────────────────────────────────────

export interface ElevateWeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orders: number;
  sessions: number;
  conversionRate: number | null;
  adSpend: number;
  adSales: number;
  adUnitSales: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
}

export interface ElevateWalmartWeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orderedItems: number;
  adSpend: number;
  adSales: number;
  adUnitSales: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
  organicSales: number;
}

// ─── Formatting utilities ───────────────────────────────────────────────────

export function wowPct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return (current - prev) / Math.abs(prev);
}

export function fmtPct(val: number | null, decimals = 1): string {
  if (val === null) return '—';
  return `${(val * 100).toFixed(decimals)}%`;
}

export function fmtDollar(val: number, decimals = 0): string {
  if (val < 0) return `-$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtRoas(val: number | null): string {
  if (val === null || val === 0) return '—';
  return `${val.toFixed(2)}x`;
}

export function acosClass(acos: number | null): string {
  if (acos === null) return 'text-gray-500';
  if (acos < 0.35) return 'text-green-400';
  if (acos <= 0.55) return 'text-amber-400';
  return 'text-red-400';
}
