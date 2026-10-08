import { DurableObject } from 'cloudflare:workers';

interface Env {
  RELAY: DurableObjectNamespace<PumpPortalRelay>;
  PUMPSAFE_INGEST_URL: string;
  PUMPSAFE_DISCOVERY_SECRET: string;
  PUMPPORTAL_API_KEY?: string;
}

const PUMPPORTAL_WS = 'wss://pumpportal.fun/api/data';
const RECONNECT_MS = 5_000;
const ROTATE_MS = 8 * 60 * 1000;

type PumpPortalEvent = {
  txType?: string;
  mint?: string;
  [key: string]: unknown;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/start' || url.pathname === '/') {
      const id = env.RELAY.idFromName('pumpfun-new-token-feed');
      const relay = env.RELAY.get(id);
      const response = await relay.fetch('https://relay/start', {
        method: 'POST',
      });
      return response;
    }

    if (url.pathname === '/status') {
      const id = env.RELAY.idFromName('pumpfun-new-token-feed');
      const relay = env.RELAY.get(id);
      return relay.fetch('https://relay/status');
    }

    return new Response('PumpSafe PumpPortal relay is running.', { status: 200 });
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const id = env.RELAY.idFromName('pumpfun-new-token-feed');
    const relay = env.RELAY.get(id);
    await relay.fetch('https://relay/start', { method: 'POST' });
  },
};

export class PumpPortalRelay extends DurableObject<Env> {
  private upstream: WebSocket | null = null;
  private connecting: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/start') {
      await this.ensureConnected();
      return Response.json({
        ok: true,
        connected: this.upstream?.readyState === WebSocket.OPEN,
      });
    }

    if (url.pathname === '/status') {
      return Response.json({
        ok: true,
        connected: this.upstream?.readyState === WebSocket.OPEN,
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async alarm(): Promise<void> {
    if (this.upstream) {
      try {
        this.upstream.close(1000, 'scheduled connection rotation');
      } catch {}
      this.upstream = null;
    }

    await this.ensureConnected();
  }

  private async ensureConnected(): Promise<void> {
    if (this.upstream?.readyState === WebSocket.OPEN) {
      await this.ctx.storage.setAlarm(Date.now() + ROTATE_MS);
      return;
    }

    if (this.connecting) {
      await this.connecting;
      return;
    }

    this.connecting = this.connect();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async connect(): Promise<void> {
    const url = new URL(PUMPPORTAL_WS);

    if (this.env.PUMPPORTAL_API_KEY?.trim()) {
      url.searchParams.set('api-key', this.env.PUMPPORTAL_API_KEY.trim());
    }

    let response: Response;

    try {
      response = await fetch(url.toString(), {
        headers: { Upgrade: 'websocket' },
      });
    } catch (error) {
      console.error('PumpPortal websocket connection failed', error);
      await this.ctx.storage.setAlarm(Date.now() + RECONNECT_MS);
      return;
    }

    const ws = response.webSocket;

    if (!ws) {
      console.error('PumpPortal did not return a websocket', response.status);
      await this.ctx.storage.setAlarm(Date.now() + RECONNECT_MS);
      return;
    }

    ws.accept();
    this.upstream = ws;

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
      ws.send(JSON.stringify({ method: 'subscribeMigration' }));
    });

    ws.addEventListener('message', event => {
      this.ctx.waitUntil(this.handleMessage(event.data));
    });

    const reconnect = () => {
      if (this.upstream === ws) {
        this.upstream = null;
        this.ctx.waitUntil(this.ctx.storage.setAlarm(Date.now() + RECONNECT_MS));
      }
    };

    ws.addEventListener('close', reconnect);
    ws.addEventListener('error', reconnect);

    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
    ws.send(JSON.stringify({ method: 'subscribeMigration' }));

    await this.ctx.storage.setAlarm(Date.now() + ROTATE_MS);
  }

  private async handleMessage(data: string | ArrayBuffer): Promise<void> {
    const raw = typeof data === 'string'
      ? data
      : new TextDecoder().decode(data);

    let event: PumpPortalEvent;

    try {
      event = JSON.parse(raw) as PumpPortalEvent;
    } catch {
      return;
    }

    if (event.txType !== 'create' || typeof event.mint !== 'string') {
      return;
    }

    try {
      const response = await fetch(this.env.PUMPSAFE_INGEST_URL, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + this.env.PUMPSAFE_DISCOVERY_SECRET,
          'content-type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.error(
          'PumpSafe ingest failed',
          response.status,
          await response.text(),
        );
      }
    } catch (error) {
      console.error('PumpSafe ingest request failed', error);
    }
  }
}
