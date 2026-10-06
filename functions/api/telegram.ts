import type { Env } from '../../src/lib/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const token = request.headers.get('x-telegram-bot-api-secret-token');
    if (token !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 });
  }
  const update = await request.json().catch(() => null) as any;
  console.log('telegram update', JSON.stringify(update));
  return Response.json({ ok: true });
};
