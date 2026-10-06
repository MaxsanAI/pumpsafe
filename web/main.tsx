import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Token = {
  mint: string; name: string; symbol: string; score: number; source: string; detectedAt: number;
  mintAuthorityDisabled: boolean; freezeAuthorityDisabled: boolean; top10Pct: number;
  lpVerified: boolean; bundleRisk: number; devRisk: number; liquidityUsd: number | null; reason: string;
};

const short = (v: string) => `${v.slice(0, 5)}…${v.slice(-5)}`;
const links = (mint: string) => ({
  dex: `https://dexscreener.com/solana/${mint}`,
  gmgn: `https://gmgn.ai/sol/token/${mint}`,
  bullx: `https://bullx.io/terminal?chain=solana&address=${mint}`,
  trojan: `https://t.me/solana_trojanbot?start=r-ref-${mint}`,
  pump: `https://pump.fun/${mint}`,
});

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(true);
  const add = (token: Token) => setTokens((old) => [token, ...old.filter((x) => x.mint !== token.mint)].slice(0, 40));

  useEffect(() => {
    fetch('/api/tokens?limit=30').then(r => r.ok ? r.json() : { tokens: [] }).then(d => setTokens(d.tokens ?? [])).catch(() => undefined);
    const es = new EventSource('/api/events');
    es.onopen = () => setLive(true);
    es.onmessage = (e) => { try { const token = JSON.parse(e.data) as Token; add(token); if (!muted && 'Notification' in window && Notification.permission === 'granted') new Notification(`SafePump ${token.score}`, { body: `${token.symbol} passed the safety gate.` }); } catch {} };
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [muted]);

  const verified = useMemo(() => tokens.filter(t => t.score >= 85 && t.lpVerified), [tokens]);

  return <div className="shell">
    <header className="topbar">
      <div className="brand"><div className="logo">✓</div><div><strong>SafePump</strong><span>Solana anti-rug intelligence</span></div></div>
      <div className="status"><i className={live ? 'on' : ''}></i>{live ? 'LIVE FEED' : 'RECONNECTING'}</div>
    </header>
    <main>
      <section className="hero">
        <div><p className="eyebrow">AUTOMATED ON-CHAIN SCREENING</p><h1>Find safer Solana launches<br/><em>before the crowd.</em></h1><p className="sub">Every candidate is checked against authority, holder concentration, launch-wallet behavior and liquidity evidence. Only tokens that clear the hard safety gate are recommended.</p></div>
        <div className="heroStats"><div><b>85+</b><span>minimum score</span></div><div><b>{verified.length}</b><span>verified now</span></div><div><b>{tokens.length}</b><span>recent scans</span></div></div>
      </section>
      <section className="toolbar"><div><b>Live recommendations</b><span> · refreshed automatically</span></div><button onClick={() => { setMuted(!muted); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }}>{muted ? 'Enable alerts' : 'Alerts on'}</button></section>
      {verified.length === 0 && <div className="empty"><div>◎</div><h2>Waiting for verified launches</h2><p>SafePump is connected. A token appears here only after the server-side safety gate passes.</p></div>}
      <div className="grid">{verified.map(t => <TokenCard key={t.mint} token={t} />)}</div>
    </main>
    <footer>SafePump is a risk-scoring system, not a guarantee. Always verify the token and pool yourself before trading.</footer>
  </div>;
}

function TokenCard({ token }: { token: Token; key?: string }) {
  const l = links(token.mint);
  return <article className="card">
    <div className="cardTop"><div><div className="symbol">${token.symbol || 'TOKEN'}</div><h2>{token.name || 'Unknown token'}</h2><code>{short(token.mint)}</code></div><div className="score"><b>{token.score}</b><span>/100</span><small>SAFE</small></div></div>
    <p className="reason">{token.reason}</p>
    <div className="checks"><span className={token.mintAuthorityDisabled ? 'ok' : 'bad'}>Mint authority</span><span className={token.freezeAuthorityDisabled ? 'ok' : 'bad'}>Freeze authority</span><span className={token.lpVerified ? 'ok' : 'bad'}>LP evidence</span><span className={token.bundleRisk < 20 ? 'ok' : 'warn'}>Launch cluster</span></div>
    <div className="metrics"><div><span>Top 10</span><b>{token.top10Pct.toFixed(1)}%</b></div><div><span>Liquidity</span><b>{token.liquidityUsd == null ? '—' : `$${Math.round(token.liquidityUsd).toLocaleString()}`}</b></div><div><span>Source</span><b>{token.source}</b></div></div>
    <div className="actions"><a href={l.dex} target="_blank" rel="noreferrer">DEXScreener</a><a href={l.gmgn} target="_blank" rel="noreferrer">GMGN</a><a href={l.bullx} target="_blank" rel="noreferrer">BullX</a><a href={l.trojan} target="_blank" rel="noreferrer">Trojan</a><a href={l.pump} target="_blank" rel="noreferrer">Pump.fun</a></div>
  </article>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
