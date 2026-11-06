# SPP API health-check contract

The admin header and sidebar render only a small indicator. They do not display an “API Live mode” label. The indicator pulses green only when the configured endpoint confirms a healthy backend.

## Frontend configuration

Set these values in `config.js`:

```js
window.SPP_CONFIG = Object.freeze({
  API_BASE_URL: 'https://api.your-domain.com',
  API_HEALTH_PATH: '/api/health',
  ADMIN_NAME: 'Administrator Full Name',
  ADMIN_ROLE: 'Administrator',
  HEALTH_CHECK_INTERVAL_MS: 30000
});
```

Leave `API_BASE_URL` blank for a same-origin API.

## Required response

The frontend accepts HTTP 2xx with JSON containing one of:

```json
{ "status": "ok" }
```

```json
{ "status": "healthy" }
```

```json
{ "status": "live" }
```

```json
{ "ok": true }
```

```json
{ "healthy": true }
```

A minimal Express route for local backend testing is:

```js
app.get('/api/health', async (req, res) => {
  // In production, include checks for required dependencies such as the database,
  // object storage and core application services before declaring the system healthy.
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

Do not use a trivial health route as proof that every application integration is connected. Production health checks should report failures in critical dependencies, and the CMS, media, payments, analytics, SYFM and AI provider APIs must each have their own authenticated endpoints and connection checks.

## Administrator identity

`ADMIN_NAME` and `ADMIN_ROLE` are frontend defaults for the visual prototype. In production, inject the signed-in administrator name and role from the authenticated backend session. Do not use a user-editable public config value as an access-control decision.

## Security

Never store provider API keys, payment secrets, database passwords or private OAuth tokens in `config.js` or browser JavaScript. Keep them in server-side secret storage. Protect health and application routes appropriately, and do not expose dependency details or secrets in public health responses.
