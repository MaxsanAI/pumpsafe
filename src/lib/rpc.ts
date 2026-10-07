const RETRIES = 2;
const REQUEST_TIMEOUT_MS = 10000;
const PUBLIC_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rpcUrls(primary: string | undefined, fallback?: string): string[] {
  const urls = [primary, fallback, PUBLIC_SOLANA_RPC]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter(url => !/helius/i.test(url));

  return [...new Set(urls)];
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
}

export async function rpc<T>(
  url: string | undefined,
  method: string,
  params: unknown[],
  fallbackUrl?: string,
): Promise<T> {
  let lastError: unknown = null;

  for (const endpoint of rpcUrls(url, fallbackUrl)) {
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method,
            params,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryable = isRetryableHttpStatus(response.status);
          const error = Object.assign(
            new Error(`RPC HTTP ${response.status}`),
            { retryable },
          );

          lastError = error;

          if (response.status === 401 || response.status === 403) break;

          throw error;
        }

        const body = await response.json() as {
          result?: T;
          error?: { message?: string; code?: number };
        };

        if (body.error) {
          const message = body.error.message ?? 'RPC error';
          const retryable =
            body.error.code === -32005 ||
            /rate.?limit|too many requests|temporar|timeout/i.test(message);

          throw Object.assign(new Error(message), { retryable });
        }

        if (body.result === undefined) throw new Error('RPC returned no result');
        return body.result;
      } catch (error) {
        lastError = error;

        const retryable =
          Boolean((error as { retryable?: boolean })?.retryable) ||
          (error instanceof Error && error.name === 'AbortError');

        if (!retryable || attempt === RETRIES) break;

        await sleep(Math.min(3000, 450 * 2 ** attempt) + Math.floor(Math.random() * 200));
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('RPC request failed');
}