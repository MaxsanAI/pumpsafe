import React from 'react';
import './styles.css';

type Page = {
  path: string;
  title: string;
  eyebrow: string;
  intro: string;
  sections: { title: string; body: React.ReactNode }[];
};

const email = 'support@pumpsafe.app';

const pages: Record<string, Page> = {
  '/terms': {
    path:'/terms', title:'Terms of Service', eyebrow:'LEGAL · TERMS', intro:'These Terms govern your use of PumpSafe and the services, interfaces and information we make available through the PumpSafe website.',
    sections:[
      {title:'1. Acceptance',body:<p>By accessing or using PumpSafe, you agree to these Terms. If you do not agree, do not use the service. PumpSafe may update these Terms from time to time; continued use after an update constitutes acceptance of the revised Terms.</p>},
      {title:'2. What PumpSafe provides',body:<p>PumpSafe provides automated token-security signals, on-chain observations, market data and research tools for Solana assets. The service is informational only. We do not execute trades, custody assets, manage wallets, provide investment advice, or guarantee the outcome of any transaction.</p>},
      {title:'3. No guarantee of safety',body:<p>A score, label, warning, verification status or absence of a warning is not a guarantee that a token is safe, legitimate, profitable, liquid, or free from malicious activity. Blockchain conditions can change after a scan, and third-party data can be delayed, incomplete or incorrect.</p>},
      {title:'4. Your responsibility',body:<p>You are solely responsible for your wallet, private keys, transaction approvals, trading decisions and due diligence. Never share a seed phrase or private key with PumpSafe or any other website.</p>},
      {title:'5. Third-party services',body:<p>PumpSafe may link to or display information from third-party services, decentralized exchanges, analytics providers, blockchains and other websites. Their availability, accuracy, policies and security are outside PumpSafe's control.</p>},
      {title:'6. Prohibited use',body:<p>You may not use PumpSafe to interfere with the service, bypass access controls, abuse APIs, distribute malware, impersonate PumpSafe, scrape the service at abusive rates, or use the service for unlawful activity.</p>},
      {title:'7. Availability and changes',body:<p>PumpSafe may change, suspend or discontinue features without notice. We do not promise uninterrupted availability or permanent retention of scan history.</p>},
      {title:'8. Limitation of liability',body:<p>To the maximum extent permitted by applicable law, PumpSafe and its operators are not liable for losses arising from trading, token ownership, smart contracts, wallet activity, third-party services, inaccurate data, service interruption or reliance on PumpSafe information.</p>},
      {title:'9. Contact',body:<p>Questions about these Terms can be sent to <a href={'mailto:'+email}>{email}</a>.</p>}
    ]
  },
  '/privacy': {
    path:'/privacy', title:'Privacy Policy', eyebrow:'LEGAL · PRIVACY', intro:'This policy explains what information PumpSafe may process when you visit the website or use its scanning features.',
    sections:[
      {title:'1. Information we process',body:<p>When you submit a Solana mint for scanning, PumpSafe may process the public mint address, scan results, timestamps and related public blockchain or market information. A Solana address is public blockchain data; PumpSafe does not need your private key or seed phrase to perform a scan.</p>},
      {title:'2. Technical information',body:<p>Like most web services, infrastructure may process basic technical information needed to deliver requests, protect the service and diagnose failures, such as request metadata, timestamps and security logs. We aim to collect only what is reasonably necessary for operation.</p>},
      {title:'3. Cookies and storage',body:<p>PumpSafe may use essential browser storage or similar technologies for functionality, preferences and security. See the Cookie Policy for more detail. We do not ask for wallet credentials or private keys.</p>},
      {title:'4. Third-party providers',body:<p>Market and blockchain information may be obtained from third-party infrastructure providers. Those providers may process requests under their own privacy policies. PumpSafe does not control their independent data practices.</p>},
      {title:'5. Retention',body:<p>Scan records may be retained to provide recent audit history, system functionality, abuse prevention and service analytics. Retention periods may vary as the service evolves.</p>},
      {title:'6. Your choices',body:<p>You can avoid submitting a mint if you do not want PumpSafe to process that public address through the service. For privacy questions or requests, contact <a href={'mailto:'+email}>{email}</a>.</p>},
      {title:'7. Security',body:<p>We use reasonable technical measures for the service, but no internet service or blockchain system can be guaranteed completely secure.</p>}
    ]
  },
  '/risk-disclosure': {
    path:'/risk-disclosure', title:'Risk Disclosure', eyebrow:'LEGAL · RISK', intro:'Crypto assets can involve extreme volatility, illiquidity, scams, exploits and permanent loss. Read this before relying on PumpSafe.',
    sections:[
      {title:'Crypto assets are high risk',body:<p>Digital assets can lose most or all of their value. Prices can move rapidly, liquidity can disappear, markets can be manipulated, and tokens can become impossible to sell.</p>},
      {title:'A security scan is not due diligence',body:<p>PumpSafe evaluates a limited set of observable signals. It cannot reliably detect every malicious contract, insider arrangement, oracle issue, exploit, market manipulation technique, social-engineering attack or future change to a token.</p>},
      {title:'On-chain state changes',body:<p>Authorities, holders, liquidity, pools and other conditions can change after a scan. A historical scan should never be treated as a permanent certification.</p>},
      {title:'Third-party data risk',body:<p>Market prices, liquidity, token metadata and other information can come from external systems. Data may be missing, stale, inconsistent or unavailable.</p>},
      {title:'Do your own research',body:<p>Before interacting with a token, independently verify the mint address, token program, authorities, holders, liquidity and trading venue. Verify the destination of every transaction in your wallet before signing.</p>},
      {title:'Not financial advice',body:<p>Nothing on PumpSafe is financial, legal, tax or investment advice, or a recommendation to buy, sell or hold any asset.</p>}
    ]
  },
  '/cookies': {
    path:'/cookies', title:'Cookie Policy', eyebrow:'LEGAL · COOKIES', intro:'PumpSafe is designed to keep tracking lightweight and focused on essential functionality.',
    sections:[
      {title:'Essential technologies',body:<p>We may use browser storage, cookies or similar technologies where necessary to operate the website, remember preferences, maintain security and support core functionality.</p>},
      {title:'Analytics and third parties',body:<p>If analytics, advertising or other optional third-party technologies are introduced, they may place or access their own identifiers subject to their respective policies. Any such use should be reviewed before relying on this policy as a complete description of a future configuration.</p>},
      {title:'Managing cookies',body:<p>You can control cookies through your browser settings. Blocking essential storage may affect parts of the site.</p>}
    ]
  },
  '/acceptable-use': {
    path:'/acceptable-use', title:'Acceptable Use Policy', eyebrow:'LEGAL · USE', intro:'PumpSafe is intended for legitimate research and security analysis of public blockchain information.',
    sections:[
      {title:'Allowed use',body:<p>Use PumpSafe for token research, security analysis, education, monitoring and other lawful activities involving public blockchain data.</p>},
      {title:'Do not abuse the service',body:<p>Do not overload endpoints, circumvent rate limits, probe infrastructure without authorization, introduce malicious code, attempt unauthorized access, or interfere with other users.</p>},
      {title:'No fraud or manipulation',body:<p>Do not use PumpSafe to facilitate fraud, impersonation, phishing, theft, market manipulation, sanctions evasion or other unlawful conduct.</p>},
      {title:'Enforcement',body:<p>We may restrict access, rate-limit requests or take other reasonable measures when necessary to protect the service, users or third parties.</p>}
    ]
  },
  '/security': {
    path:'/security', title:'Security & Responsible Disclosure', eyebrow:'TRUST · SECURITY', intro:'We want PumpSafe to be a responsible security product. If you find a security issue, please report it privately.',
    sections:[
      {title:'Report a vulnerability',body:<p>Please email <a href={'mailto:'+email}>{email}</a> with the affected URL or component, a clear description, reproduction steps and the potential impact. Do not include private keys, seed phrases or other secrets.</p>},
      {title:'Good-faith testing',body:<p>Avoid destructive testing, denial-of-service activity, data extraction beyond what is necessary to demonstrate the issue, or access to other users' information. Give us a reasonable opportunity to investigate before public disclosure.</p>},
      {title:'What we can do',body:<p>We will review credible reports and, where appropriate, work to remediate confirmed issues. Response times can vary by severity and operational circumstances.</p>}
    ]
  },
  '/methodology': {
    path:'/methodology', title:'Methodology & Limitations', eyebrow:'TRUST · METHODOLOGY', intro:'PumpSafe combines on-chain checks with market context to produce a risk signal. It is a screening system, not a certification system.',
    sections:[
      {title:'Security signals',body:<p>The current scanner evaluates token mint and freeze authority state, holder concentration, liquidity conditions, LP evidence, and selected launch-cluster and developer-risk signals. Individual signals contribute to a composite score.</p>},
      {title:'Risk score',body:<p>The score is a model output from the observed signals at scan time. It is not a probability of a rug pull and should not be interpreted as one.</p>},
      {title:'Market context',body:<p>Where available, PumpSafe can display price, liquidity, market capitalization, volume, transactions and token imagery from external market-data sources. These fields may be unavailable for new or thinly traded tokens.</p>},
      {title:'Unknown is not safe',body:<p>Missing metadata or unavailable third-party information does not mean a token is safe. A future version of the scanner may show an explicit data-confidence state alongside the security score.</p>},
      {title:'Continuous improvement',body:<p>Detection methods evolve as scams and market infrastructure change. We may adjust scoring, data sources and thresholds without treating historical scores as permanent certifications.</p>}
    ]
  },
  '/about': {
    path:'/about', title:'About PumpSafe', eyebrow:'PUMPSAFE · ABOUT', intro:'PumpSafe is a Solana token intelligence and risk-screening product built to make on-chain research faster and easier to understand.',
    sections:[
      {title:'What we are building',body:<p>PumpSafe brings security signals, token identity, market context and research links into one interface. The goal is to help users spot important warning signs before interacting with a token.</p>},
      {title:'What we are not',body:<p>PumpSafe is not a wallet, exchange, broker, investment adviser or guarantee provider. We do not ask for seed phrases or private keys.</p>},
      {title:'Principles',body:<p>Clear signals, transparent limitations, independent verification and cautious language are core product principles. A warning should be understandable, and a positive signal should never be presented as certainty.</p>}
    ]
  },
  '/contact': {
    path:'/contact', title:'Contact PumpSafe', eyebrow:'PUMPSAFE · CONTACT', intro:'For security reports, privacy questions, legal questions or general product feedback, contact the PumpSafe team.',
    sections:[
      {title:'General support',body:<p>Email <a href={'mailto:'+email}>{email}</a> with the subject and a concise description of the issue.</p>},
      {title:'Security reports',body:<p>For vulnerabilities, please use the Security & Responsible Disclosure guidance and include reproduction details without sharing secrets.</p>},
      {title:'Important',body:<p>Do not send seed phrases, private keys, wallet recovery codes or passwords. PumpSafe will never need them to scan a public Solana token.</p>}
    ]
  }
};

function LegalPage({page}:{page:Page}){
  return <div className="legalShell"><header className="topbar"><a className="brand legalBrand" href="/"><div className="logo">◉</div><div><strong>PumpSafe</strong><span>Solana token intelligence</span></div></a><a className="legalBack" href="/">← Back to scanner</a></header><main className="legalMain"><div className="legalHero"><p className="eyebrow">{page.eyebrow}</p><h1>{page.title}</h1><p>{page.intro}</p></div><article className="legalCard">{page.sections.map((s,i)=><section key={i}><h2>{s.title}</h2>{s.body}</section>)}</article><div className="legalNav"><a href="/about">About</a><a href="/methodology">Methodology</a><a href="/risk-disclosure">Risk Disclosure</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/acceptable-use">Acceptable Use</a><a href="/security">Security</a><a href="/contact">Contact</a></div></main></div>;
}

export { LegalPage, pages };
