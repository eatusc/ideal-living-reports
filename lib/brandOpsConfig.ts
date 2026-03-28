export const DEFAULT_ACOS_TARGET = 0.30;

export const BRAND_CHANNELS = {
  'rpd-walmart': ['walmart-ads', 'sem'],
  'elevate': ['amazon', 'walmart', 'sem'],
  'rpd-hd': ['orange-access'],
  'lustroware': ['walmart'],
  'somarsh': ['walmart'],
} as const;

export type BrandKey = keyof typeof BRAND_CHANNELS;
export type ChannelKey = typeof BRAND_CHANNELS[BrandKey][number];

export const BRAND_LABELS: Record<BrandKey, string> = {
  'rpd-walmart': 'RPD Walmart',
  elevate: 'Elevate',
  'rpd-hd': 'RPD Home Depot',
  lustroware: 'Lustroware',
  somarsh: 'Southern Marsh',
};

export const CHANNEL_LABELS: Record<string, string> = {
  'walmart-ads': 'Walmart Ads',
  sem: 'SEM',
  amazon: 'Amazon',
  walmart: 'Walmart',
  'orange-access': 'Orange Access',
};

export const BRAND_ROUTES: Record<BrandKey, string> = {
  'rpd-walmart': '/rpd-walmart',
  elevate: '/elevate',
  'rpd-hd': '/rpd-hd',
  lustroware: '/lustroware',
  somarsh: '/somarsh',
};

export function isValidBrandKey(value: string): value is BrandKey {
  return value in BRAND_CHANNELS;
}

export function isValidChannelKeyForBrand(brand: BrandKey, channel: string): channel is ChannelKey {
  return (BRAND_CHANNELS[brand] as readonly string[]).includes(channel);
}

export function getGoalDimensions(): Array<{ brandKey: BrandKey; channelKey: ChannelKey }> {
  return (Object.entries(BRAND_CHANNELS) as Array<[BrandKey, readonly ChannelKey[]]>).flatMap(
    ([brandKey, channels]) => channels.map((channelKey) => ({ brandKey, channelKey }))
  );
}
