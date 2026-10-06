import { recentAudits } from '../../src/lib/store';
import type { Env } from '../../src/lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const encoder = new TextEncoder();
  let stopped = false;
  request.signal.addEventListener('abort', () => { stopped = true; });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      let last = '';
      try {
        while (!stopped) {
          const rows = await recentAudits(env, 10);
          const newest = rows[0];
          if (newest && newest.mint !== last) { last = newest.mint; controller.enqueue(encoder.encode(`data: ${JSON.stringify(newest)}\n\n`)); }
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          await new Promise(r => setTimeout(r, 2500));
        }
      } catch (e) { console.error('sse', e); }
      try { controller.close(); } catch {}
    }
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' } });
};
