# PumpSafe PumpPortal Relay

This Worker keeps one persistent PumpPortal WebSocket connection for PumpSafe.

## Required Worker secrets / variables

- `PUMPSAFE_INGEST_URL` — PumpSafe Pages URL + `/api/discovery/ingest`
- `PUMPSAFE_DISCOVERY_SECRET` — must match PumpSafe's `DISCOVERY_SECRET`
- `PUMPPORTAL_API_KEY` — optional; not required for new-token/migration streams

After deployment, the relay starts from its 5-minute Cron Trigger. It can also be started manually with `/start` and checked with `/status`.

The relay uses one WebSocket connection and rotates it periodically with only one connection active at a time.
