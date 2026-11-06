# Website navigation, publishing status and API health — v5.2

## Primary website navigation

Top-level items are Home, About, Service, Production, Team, Our Webs, Our Story and Contact. Service, Production, Team, Our Webs and Our Story have editable starter dropdowns. These submenu labels are suggestions and can be changed from Website Menus. The same hierarchical navigation is shown in the page-builder preview.

## Content workflow states

The CMS editor and create-content form use exactly four publishing states: Draft, Pending review, Scheduled and Published. CMS content can be filtered by these states. These are workflow values; a state change is persisted only in the browser until the CMS API is connected.

## Administrator identity

The top bar displays `Welcome, Administrator (Engr. Deevinite Ohimaime)` and repeats the name with the Administrator role in the profile. Configure `ADMIN_NAME` and `ADMIN_ROLE` in `config.js` or inject them from the authenticated server session. In production, identity should be sourced from the authenticated session, not trusted from a public frontend config.

## API health light

The header and sidebar display a light only; no textual “API Live mode” badge is shown. The light pulses green only after a successful health check. Configure `API_BASE_URL` and `API_HEALTH_PATH` in `config.js`. The endpoint must return HTTP 2xx and JSON containing `{\"status\":\"ok\"}`, `{\"status\":\"healthy\"}`, `{\"status\":\"live\"}`, `{\"ok\":true}` or `{\"healthy\":true}`. The frontend checks on load and every 30 seconds. When no API is configured or the check fails, the indicator remains grey.

This ZIP does not contain the existing production backend, credentials, authenticated user session or a real API endpoint. Therefore the API indicator cannot truthfully be green until the actual backend is supplied and health-check verified. Never put private API keys in `config.js`; use server-side secrets and authenticated API routes.
