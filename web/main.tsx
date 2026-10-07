import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type TokensResponse = { tokens?: Token[] };
type Stats = { scanned: number; safe: number; blocked: number };

type Token = {
  mint: string;
  name: string;
  symbol: string;
  score: number;
  source: string;
  detectedAt: number;
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  top10Pct: number;
  lpVerified: boolean;
  bundleRisk: number;
  devRisk: number;
  liquidityUsd: number | null;
  reason: string;
  recommendation?: boolean;
};

const short = (v: string) => v.slice(0, 5) + '…' + v.slice(-5);

const links = (mint: string) => ({
  dex: 'https://dexscreener.com/solana/' + mint,
  gmgn: 'https://gmgn.ai/sol/token/' + mint,
  bullx: 'https://bullx.io/terminal?chain=solana&address=' + mint,
  trojan: 'https://t.me/solana_trojanbot?start=r-ref-' + mint,
  pump: 'https://pump.fun/' + mint,
});

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(true);
  const [stats, setStats] = useState<Stats>({ scanned: 0, safe: 0, blocked: 0 });
  const [mint, setMint] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState<Token | null>(null);

  const add = (token: Token) => {
    setTokens((old) => [token, ...old.filter((x) => x.mint !== token.mint)].slice(0, 40));
  };

  useEffect(() => {
    fetch('/api/tokens?limit=30')
      .then((r) => (r.ok ? (r.json() as Promise<TokensResponse>) : { tokens: [] }))
      .then((d) => setTokens(Array.isArray(d.tokens) ? d.tokens : []))
      .catch(() => undefined);

    const loadStats = () =>
      fetch('/api/stats')
        .then((r) => (r.ok ? (r.json() as Promise<Stats>) : null))
        .then((d) => d && setStats(d))
        .catch(() => undefined);

    loadStats();
    const timer = window.setInterval(loadStats, 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.onopen = () => setLive(true);
    es.onmessage = (event) => {
      try {
        const token = JSON.parse(event.data) as Token;
        add(token);

        if (!muted && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('SafePump ' + (token.recommendation ? 'SAFE' : 'RUG RISK'), {
            body: (token.symbol || 'TOKEN') + ' scored ' + token.score + '/100.',
          });
        }
      } catch {
        // Ignore malformed stream events.
      }
    };
    es.onerror = () => setLive(false);

    return () => es.close();
  }, [muted]);

  async function manualScan(event: React.FormEvent) {
    event.preventDefault();

    const value = mint.trim();
    if (!value) return;

    setScanning(true);
    setScanError('');
    setScanResult(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mint: value }),
      });

      const data = (await response.json()) as { audit?: Token; error?: string };

      if (!response.ok || !data.audit) {
        throw new Error(data.error || 'Scan failed.');
      }

      setScanResult(data.audit);
      add(data.audit);
      setStats((s) => ({
        scanned: s.scanned + 1,
        safe: s.safe + (data.audit?.recommendation ? 1 : 0),
        blocked: s.blocked + (data.audit?.recommendation ? 0 : 1),
      }));
      setMint('');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  }

  const toggleAlerts = () => {
    setMuted((current) => !current);
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-label="SafePump safety gauge">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <defs>
                <linearGradient id="safePumpGauge" x1="12" y1="54" x2="52" y2="10" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#22c55e" />
                  <stop offset=".55" stopColor="#34d399" />
                  <stop offset="1" stopColor="#67e8f9" />
                </linearGradient>
              </defs>
              <path d="M10 46a22 22 0 0 1 44 0" fill="none" stroke="#244052" strokeWidth="6" strokeLinecap="round" />
              <path d="M10 46a22 22 0 0 1 35-17" fill="none" stroke="url(#safePumpGauge)" strokeWidth="6" strokeLinecap="round" />
              <path d="M32 46 49 20" fill="none" stroke="#eaf5f1" strokeWidth="5" strokeLinecap="round" />
              <path d="m49 20-1 13-11-7z" fill="#eaf5f1" />
              <circle cx="32" cy="46" r="5" fill="#07111f" stroke="#eaf5f1" strokeWidth="3" />
            </svg>
          </div>
          <div>
            <strong>SafePump</strong>
            <span>Solana anti-rug intelligence</span>
          </div>
        </div>
        <div className="status">
          <i className={live ? 'on' : ''}></i>
          {live ? 'LIVE FEED' : 'RECONNECTING'}
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">AUTOMATED ON-CHAIN SCREENING</p>
            <h1>
              Scan Solana tokens
              <br />
              <em>spot the rug risk.</em>
            </h1>
            <p className="sub">
              Every scanned token gets a full on-chain risk analysis. SafePump keeps
              both safe and risky results visible so you can see exactly why a token
              was marked SAFE or RUG RISK.
            </p>
          </div>

          <div className="heroStats">
            <div>
              <b>{stats.scanned.toLocaleString()}</b>
              <span>all tokens scanned</span>
            </div>
            <div>
              <b>{stats.safe.toLocaleString()}</b>
              <span>safe candidates</span>
            </div>
            <div>
              <b>{stats.blocked.toLocaleString()}</b>
              <span>rugs blocked</span>
            </div>
          </div>
        </section>

        <section className="scanner">
          <div>
            <p className="eyebrow">CHECK A TOKEN</p>
            <h2>Scan any Solana mint</h2>
            <p>Paste a contract address and get the complete SafePump risk analysis.</p>
          </div>

          <form onSubmit={manualScan}>
            <input
              value={mint}
              onChange={(event) => setMint(event.target.value)}
              placeholder="Solana token mint address"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" disabled={scanning}>
              {scanning ? 'Scanning…' : 'Scan Token'}
            </button>
          </form>

          {scanError && <div className="scanError">{scanError}</div>}
        </section>

        {scanResult && (
          <section className="scanResult">
            <div className="scanResultMain">
              <span className="resultLabel">SCAN RESULT</span>
              <strong>{scanResult.name || 'Unknown token'} <small>{'$' + (scanResult.symbol || 'TOKEN')}</small></strong>
              <code>{scanResult.mint}</code>
              <p className="resultReason">{scanResult.reason || 'No rejection reason was returned.'}</p>
              <div className="resultChecks">
                <span className={scanResult.mintAuthorityDisabled ? 'ok' : 'bad'}>Mint authority: {scanResult.mintAuthorityDisabled ? 'REVOKED' : 'ACTIVE'}</span>
                <span className={scanResult.freezeAuthorityDisabled ? 'ok' : 'bad'}>Freeze authority: {scanResult.freezeAuthorityDisabled ? 'REVOKED' : 'ACTIVE'}</span>
                <span className={scanResult.lpVerified ? 'ok' : 'bad'}>LP evidence: {scanResult.lpVerified ? 'VERIFIED' : 'NOT VERIFIED'}</span>
                <span className={scanResult.top10Pct <= 35 ? 'ok' : 'bad'}>Top 10: {scanResult.top10Pct.toFixed(1)}%</span>
                <span className={(scanResult.liquidityUsd ?? 0) >= 10000 ? 'ok' : 'bad'}>Liquidity: {scanResult.liquidityUsd == null ? 'UNKNOWN' : '$' + Math.round(scanResult.liquidityUsd).toLocaleString()}</span>
              </div>
            </div>
            <div className={scanResult.recommendation ? 'resultPass' : 'resultBlock'}>
              <span>{scanResult.recommendation ? '✓ SAFE' : '⚠ RUG RISK'}</span>
              <b>{scanResult.score}<small>/100</small></b>
            </div>
          </section>
        )}
        <section className="toolbar">
          <div>
            <b>Scanned Token Analysis</b>
            <span> · SAFE and RUG RISK</span>
          </div>
          <button onClick={toggleAlerts}>
            {muted ? 'Enable alerts' : 'Alerts on'}
          </button>
        </section>

        {tokens.length === 0 && (
          <div className="empty">
            <div>◎</div>
            <h2>No token audits yet</h2>
            <p>
              Scan a Solana mint above. SafePump will keep the complete result here,
              whether the token is marked SAFE or RUG RISK.
            </p>
          </div>
        )}

        <div className="grid">
          {tokens.map((token) => (
            <TokenCard key={token.mint} token={token} />
          ))}
        </div>
      </main>

      <footer>
        SafePump is a risk-scoring system, not a guarantee. Always verify the token
        and pool yourself before trading.
      </footer>
    </div>
  );
}

function TokenCard({ token }: { token: Token }) {
  const l = links(token.mint);

  return (
    <article className="card">
      <div className="cardTop">
        <div>
          <div className="symbol">{'$' + (token.symbol || 'TOKEN')}</div>
          <h2>{token.name || 'Unknown token'}</h2>
          <code>{short(token.mint)}</code>
        </div>

        <div className="score">
          <b>{token.score}</b>
          <span>/100</span>
          <small>{token.recommendation ? 'SAFE' : 'RUG RISK'}</small>
        </div>
      </div>

      <p className="reason">{token.reason}</p>

      <div className="checks">
        <span className={token.mintAuthorityDisabled ? 'ok' : 'bad'}>Mint authority</span>
        <span className={token.freezeAuthorityDisabled ? 'ok' : 'bad'}>Freeze authority</span>
        <span className={token.lpVerified ? 'ok' : 'bad'}>LP evidence</span>
        <span className={token.bundleRisk < 20 ? 'ok' : token.bundleRisk < 45 ? 'warn' : 'bad'}>Launch cluster</span>
      </div>

      <div className="metrics">
        <div>
          <span>Top 10</span>
          <b>{token.top10Pct.toFixed(1)}%</b>
        </div>
        <div>
          <span>Liquidity</span>
          <b>
            {token.liquidityUsd == null
              ? '—'
              : '$' + Math.round(token.liquidityUsd).toLocaleString()}
          </b>
        </div>
        <div>
          <span>Bundle risk</span>
          <b>{token.bundleRisk}/100</b>
        </div>
        <div>
          <span>Dev risk</span>
          <b>{token.devRisk}/100</b>
        </div>
      </div>

      <div className="actions">
        <a href={l.dex} target="_blank" rel="noreferrer">DEXScreener</a>
        <a href={l.gmgn} target="_blank" rel="noreferrer">GMGN</a>
        <a href={l.bullx} target="_blank" rel="noreferrer">BullX</a>
        <a href={l.trojan} target="_blank" rel="noreferrer">Trojan</a>
        <a href={l.pump} target="_blank" rel="noreferrer">Pump.fun</a>
      </div>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
