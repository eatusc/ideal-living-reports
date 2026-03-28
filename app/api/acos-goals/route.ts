import { NextRequest, NextResponse } from 'next/server';
import { readAcosGoals, upsertAcosGoal } from '@/lib/acosGoals';
import { isValidBrandKey, isValidChannelKeyForBrand } from '@/lib/brandOpsConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const goals = await readAcosGoals();
  return NextResponse.json({ goals }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  });
}

export async function POST(request: NextRequest) {
  let body: { brandKey?: string; channelKey?: string; targetAcos?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const brandKey = body.brandKey?.trim() ?? '';
  const channelKey = body.channelKey?.trim() ?? '';
  const targetAcos = body.targetAcos;

  if (!isValidBrandKey(brandKey)) {
    return NextResponse.json({ error: 'Invalid brandKey' }, { status: 400 });
  }
  if (!isValidChannelKeyForBrand(brandKey, channelKey)) {
    return NextResponse.json({ error: 'Invalid channelKey for selected brand' }, { status: 400 });
  }
  if (typeof targetAcos !== 'number' || Number.isNaN(targetAcos) || !Number.isFinite(targetAcos)) {
    return NextResponse.json({ error: 'targetAcos must be a number' }, { status: 400 });
  }

  try {
    const goal = await upsertAcosGoal({
      brandKey,
      channelKey,
      targetAcos,
    });
    return NextResponse.json({ ok: true, goal });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save ACoS goal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
