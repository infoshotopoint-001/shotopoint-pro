# Shoto Point Production – membership and deployment fixes

## Included in this package

- Restored the missing root `newsroom.js` module from the compatible Shoto Point API/newsroom build. The Express backend and Vercel adapter can now resolve their newsroom module import.
- Added multipart registration endpoints for SYFM and Shoto Point News:
  - `POST /api/public/membership/register`
  - `POST /api/public/syfm/membership/register`
  - `POST /api/public/shoto-point-news/membership/register`
- Registration records are stored in MySQL tables `syfm_memberships` and `shoto_news_memberships`. The schema initializer creates the Shoto Point News table.
- Added authenticated admin endpoints for listing and changing the status of Shoto Point News memberships:
  - `GET /api/admin/shoto-point-news-memberships`
  - `PATCH /api/admin/shoto-point-news-memberships/:id`
- Membership pages now stop and show an error if the server/database does not confirm a save; they no longer generate a slip that could be mistaken for a completed server registration.
- Registration slips carry Shoto Point branding and a print / Save as PDF action.
- SYFM masthead brand order is Shoto Point Productions (left) and SYFM (right).
- Shoto Point News article and newsroom endpoint configuration was aligned to the existing backend routes.

## Required before production use

This is a source-code package, not a live deployment. Configure the production Vercel project with the real MySQL and security environment variables from `.env.example` / `BACKEND_SETUP.md`. At minimum, set `NODE_ENV=production`, a strong `JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and the required SSL setting. Configure Cloudflare R2 credentials for durable media storage. Never commit `.env` or expose secrets in browser JavaScript.

The registration passport is currently included in the JSON payload as a resized image data URL. This is functional for the current registration form, but for a high-volume production portal the image should be moved to durable object storage (R2) and the database should store only its URL. Vercel's local filesystem is temporary.

## Validation performed

- JavaScript syntax checked across all project `.js` files.
- `package.json` and `vercel.json` parsed as valid JSON.
- Live database insert, admin approval, image persistence, and Vercel deployment cannot be verified without the site's actual production credentials and deployment environment.
