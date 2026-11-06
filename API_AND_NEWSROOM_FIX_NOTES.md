# Shoto Point API, CMS, Newsroom and SYFM Update

## What was corrected

- Restored the full MySQL-backed Express backend from the project's own CMS backup. The previous root `server.js` was a small legacy API and did not implement the CMS content-block, CMS menu, newsroom configuration and related routes used by the current admin and news pages.
- Scoped database readiness middleware to `/api` routes. Public HTML, CSS, JavaScript and media pages can now load even while the database is being configured; API routes return a clear JSON 503 if required server settings or MySQL are unavailable.
- Set `config2.js` `API_BASE_URL` to an empty string. The Admin Control Centre now calls `/api/...` on the same origin. This is the correct default when the website and API are deployed together using this project's `vercel.json` rewrite.
- Updated `package.json` to match the existing `package-lock.json` dependencies required by the restored backend and newsroom (`cors`, `dotenv`, `multer`, `rss-parser`, AWS S3/R2 SDK, Express, MySQL, authentication packages).
- Updated Newsroom rendering to display the external source status and YouTube items returned by the newsroom API instead of discarding them.
- Updated SYFM's public pages with an editorial/news-portal layout inspired by common newspaper homepage hierarchy (utility strip, masthead, section navigation, feature-led pages and story cards) while retaining SYFM's green/black/white identity and restrained navy accent.
- Added support for CMS-managed SYFM dropdown child menus. The membership registration form and the existing JOIN SYFM CTA markup/behaviour were not edited.

## Deployment requirements (must be completed by the site owner)

The code update alone cannot connect to a live database without the site's production secrets and hosting configuration. Keep your real `.env` file private; it is intentionally not included in this ZIP.

Set these values in the hosting provider's server environment (or in a private local `.env`):

- `NODE_ENV=production`
- `PUBLIC_URL=https://www.shotopoint.com` (change only if your canonical domain differs)
- `CORS_ORIGIN=https://www.shotopoint.com,https://shotopoint.com` (add any other exact trusted front-end origin only if the API is hosted separately)
- `JWT_SECRET` to a long, random secret (never use the placeholder in `.env.example`)
- `DB_HOST`, `DB_PORT=3306`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=shoto_point`
- `DB_SSL=true` when required by your managed MySQL provider
- For persistent Admin media uploads on Vercel, configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `R2_PUBLIC_URL`.
- Optional newsroom sources: `SPP_YOUTUBE_CHANNEL_ID`; external RSS feeds use environment variables in `.env.example`. BBC and FOX feeds remain disabled until appropriate commercial permission/licensing exists.

Do not copy secrets into `config2.js`, HTML, JavaScript, Git or this ZIP.

## Local installation

1. Back up the currently deployed project and database.
2. Extract this ZIP into a clean project folder. Preserve the production `.env` privately; do not overwrite it with `.env.example`.
3. Install packages with `npm install` (or `npm ci` when package-lock is retained and in sync).
4. Configure local MySQL and the private `.env` values above.
5. Start with `npm start`.
6. Check `http://127.0.0.1:5000/api/health` and `http://127.0.0.1:5000/api/health/config`.
7. Check `http://127.0.0.1:5000/api/public/newsroom-config`, `/api/public/syfm/navigation`, `/api/public/news/articles` and `/api/public/newsroom`.
8. Sign in at `/Adminlogin.html`; then test CMS Content and SYFM menus.

The restored server creates/updates the CMS V3 and selected application tables during API startup. The base MySQL database and core tables still need to exist. For a new/empty database, back it up if it contains data, then review and import `database/shoto_point_admin.sql` as described in `README.md`. Grant the DB user the required table/DDL permissions. Create the first administrator with `npm run admin:create` after importing the base schema. The server does not invent a new administrator or copy production records.

## Vercel / same-origin deployment

This project contains a Vercel rewrite from `/api/*` to `api/[...all].js`. Deploy the complete updated project to the same Vercel project so static site and API share the same origin. Select Node.js 24 (matching the lockfile), configure the environment variables in Project Settings, and redeploy. If your public HTML is hosted on a different platform from the API, set `API_BASE_URL` in `config2.js` to the full HTTPS origin of the deployed API and configure its CORS allow-list for the exact website origin.

## Verification

- `GET /api/health` should return HTTP 200 and JSON with `ok: true`, `database: "connected"` and `mysql: true` once the DB is ready.
- `GET /api/health/config` should show readiness flags without revealing secrets.
- `GET /api/public/newsroom-config` and `GET /api/public/syfm/navigation` should return `{success:true,...}`.
- `GET /api/public/news/articles` returns only published Shoto Point news. If there are no published records, the page can correctly show an empty newsroom rather than fabricated headlines.
- `GET /api/public/newsroom` returns external RSS items and source health; upstream RSS sources can independently fail or be disabled.

## SYFM protected areas

No membership-form markup, fields, submit handler or registration API was changed. The existing `JOIN SYFM` anchor and its existing classes/placement were not changed. The SYFM public shell and page styles were adjusted outside `#page-membership` only.
