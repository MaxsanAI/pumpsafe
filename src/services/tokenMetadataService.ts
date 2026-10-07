import type { Env } from '../lib/types';

export interface TokenMetadata {
  name: string;
  symbol: string;
  imageUrl: string | null;
  metadataSource: string;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  verified: boolean | null;
  organicScore: number | null;
  holderCount: number | null;
}

type JupiterToken = {
  id?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  image?: string;
  logoURI?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  extensions?: { website?: string; twitter?: string; telegram?: string };
  isVerified?: boolean;
  organicScore?: number;
  holderCount?: number;
};

type DexPair = {
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { imageUrl?: string; websites?: Array<{ url?: string }>; socials?: Array<{ type?: string; url?: string }> };
};

function clean(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function safeUrl(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function jupiter(mint: string): Promise<{ data: JupiterToken | null; status: string }> {
  try {
    const response = await fetch(
      'https://lite-api.jup.ag/tokens/v2/search?query=' + encodeURIComponent(mint),
      { headers: { accept: 'application/json' } },
    );
    if (!response.ok) return { data: null, status: 'jupiter-unavailable' };
    const body = await response.json() as unknown;
    const list = Array.isArray(body) ? body as JupiterToken[] : [];
    const exact = list.find(x => x.id === mint) ?? list[0] ?? null;
    return { data: exact, status: exact ? 'jupiter' : 'jupiter-empty' };
  } catch {
    return { data: null, status: 'jupiter-error' };
  }
}

async function dexscreener(mint: string): Promise<DexPair | null> {
  try {
    const response = await fetch(
      'https://api.dexscreener.com/latest/dex/tokens/' + encodeURIComponent(mint),
      { headers: { accept: 'application/json' } },
    );
    if (!response.ok) return null;
    const body = await response.json() as { pairs?: DexPair[] };
    return (body.pairs ?? [])
      .filter(pair => pair.baseToken?.address === mint)
      .sort((a, b) => 0)[0] ?? null;
  } catch {
    return null;
  }
}

function socialUrl(
  j: JupiterToken | null,
  type: 'website' | 'twitter' | 'telegram',
  pair: DexPair | null,
): string | null {
  const direct = type === 'website'
    ? j?.website ?? j?.extensions?.website
    : type === 'twitter'
      ? j?.twitter ?? j?.extensions?.twitter
      : j?.telegram ?? j?.extensions?.telegram;
  if (direct) return safeUrl(direct);

  const match = pair?.info?.socials?.find(x => x.type?.toLowerCase() === type);
  return safeUrl(match?.url);
}

export async function resolveTokenMetadata(env: Env, mint: string): Promise<TokenMetadata> {
  const key = 'token-meta:' + mint;
  try {
    const cached = await env.CACHE.get<TokenMetadata>(key, 'json');
    if (cached?.name && cached?.symbol) return cached;
  } catch {}

  const [jupResult, pair] = await Promise.all([jupiter(mint), dexscreener(mint)]);
  const j = jupResult.data;
  const base = pair?.baseToken;

  const name = clean(j?.name, clean(base?.name, 'Unknown token'));
  const symbol = clean(j?.symbol, clean(base?.symbol, 'TOKEN'));
  const imageUrl = safeUrl(j?.icon ?? j?.image ?? j?.logoURI) ?? safeUrl(pair?.info?.imageUrl);
  const metadataSource = imageUrl
    ? j?.icon || j?.image || j?.logoURI
      ? 'Jupiter'
      : 'DexScreener'
    : j
      ? 'Jupiter'
      : pair
        ? 'DexScreener'
        : 'fallback';

  const result: TokenMetadata = {
    name,
    symbol,
    imageUrl,
    metadataSource,
    website: socialUrl(j, 'website', pair),
    twitter: socialUrl(j, 'twitter', pair),
    telegram: socialUrl(j, 'telegram', pair),
    verified: typeof j?.isVerified === 'boolean' ? j.isVerified : null,
    organicScore: typeof j?.organicScore === 'number' ? j.organicScore : null,
    holderCount: typeof j?.holderCount === 'number' ? j.holderCount : null,
  };

  try {
    await env.CACHE.put(key, JSON.stringify(result), { expirationTtl: 86400 });
  } catch {}

  return result;
}
