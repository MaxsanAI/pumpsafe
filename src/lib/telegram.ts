import type { AuditResult, Env } from './types';

function esc(s: string) { return s.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&'); }

export async function postTelegram(env: Env, token: AuditResult) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  const buttons = [[
    { text: 'DEXScreener', url: `https://dexscreener.com/solana/${token.mint}` },
    { text: 'GMGN', url: `https://gmgn.ai/sol/token/${token.mint}` },
  ],[
    { text: 'BullX', url: `https://bullx.io/terminal?chain=solana&address=${token.mint}` },
    { text: 'Trojan', url: `https://t.me/solana_trojanbot?start=r-ref-${token.mint}` },
  ],[
    { text: 'Pump.fun', url: `https://pump.fun/${token.mint}` },
  ]];
  const body = { chat_id: env.TELEGRAM_CHAT_ID, text: `🛡️ *SafePump Alert*\n\n*${esc(token.name || 'Unknown')}* \\$${esc(token.symbol || 'TOKEN')}\nSafety Score: *${token.score}/100*\n\n${esc(token.reason)}\n\nCA: \\`${token.mint}\\``, parse_mode: 'MarkdownV2', disable_web_page_preview: true, reply_markup: { inline_keyboard: buttons } };
  const r = await fetch(`${base}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Telegram ${r.status}`);
}
