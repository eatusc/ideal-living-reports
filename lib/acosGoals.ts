import { unstable_noStore as noStore } from 'next/cache';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_ACOS_TARGET,
  type BrandKey,
  type ChannelKey,
  getGoalDimensions,
} from '@/lib/brandOpsConfig';

interface DbAcosGoal {
  brand_key: BrandKey;
  channel_key: ChannelKey;
  target_acos: number;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

export interface AcosGoal {
  brandKey: BrandKey;
  channelKey: ChannelKey;
  targetAcos: number;
}

function normalizeTarget(raw: number | null | undefined): number {
  if (typeof raw !== 'number' || Number.isNaN(raw) || !Number.isFinite(raw)) return DEFAULT_ACOS_TARGET;
  if (raw < 0) return 0;
  if (raw > 2) return 2;
  return raw;
}

function isMissingGoalsTableError(error: SupabaseErrorLike | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || (error.message ?? '').includes('brand_acos_goals');
}

export async function readAcosGoals(): Promise<AcosGoal[]> {
  noStore();
  const { data, error } = await supabase
    .from('brand_acos_goals')
    .select('brand_key, channel_key, target_acos');

  if (error) {
    if (!isMissingGoalsTableError(error)) {
      console.error('Failed to read ACoS goals:', error);
    }
    return [];
  }

  return ((data as DbAcosGoal[] | null) ?? []).map((row) => ({
    brandKey: row.brand_key,
    channelKey: row.channel_key,
    targetAcos: normalizeTarget(row.target_acos),
  }));
}

export async function getAcosGoalMap(): Promise<Record<string, number>> {
  const map: Record<string, number> = {};

  for (const dim of getGoalDimensions()) {
    map[`${dim.brandKey}|${dim.channelKey}`] = DEFAULT_ACOS_TARGET;
  }

  const rows = await readAcosGoals();
  for (const row of rows) {
    map[`${row.brandKey}|${row.channelKey}`] = normalizeTarget(row.targetAcos);
  }

  return map;
}

export async function upsertAcosGoal(input: AcosGoal): Promise<AcosGoal> {
  const targetAcos = normalizeTarget(input.targetAcos);

  const { data, error } = await supabase
    .from('brand_acos_goals')
    .upsert(
      {
        brand_key: input.brandKey,
        channel_key: input.channelKey,
        target_acos: targetAcos,
      },
      {
        onConflict: 'brand_key,channel_key',
      }
    )
    .select('brand_key, channel_key, target_acos')
    .single();

  if (error) {
    if (isMissingGoalsTableError(error)) {
      throw new Error('ACoS goals table is missing. Run app/brand-ops/schema.sql in Supabase first.');
    }
    console.error('Failed to save ACoS goal:', error);
    throw error;
  }

  const row = data as DbAcosGoal;
  return {
    brandKey: row.brand_key,
    channelKey: row.channel_key,
    targetAcos: normalizeTarget(row.target_acos),
  };
}
