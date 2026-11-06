# Backend and Admin Control Setup

This package leaves the public frontend unchanged. It adds the missing Node API, MySQL-backed administrator control endpoints, and the three Team Management groups: `ceo` (Executive), `administrative`, and `senior`.

1. Create a remote MySQL database reachable from Vercel.
2. Run the existing database SQL files, then run `database/backend-team-and-admin.sql`.
3. In Vercel, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, and a long random `JWT_SECRET`.
4. Install/deploy with `npm install` then `npm start` locally, or import the folder into Vercel.
5. Create an active record in the existing `admins` table. Its `password_hash` value must be a bcrypt hash of the administrator password.

Team API:

- `GET/POST /api/admin/team`
- `PUT/DELETE /api/admin/team/:id`
- `GET /api/public/team?group=ceo|administrative|senior`

The original admin interface already exposes Executive, Administrative, and Senior options. This backend persists and returns those groups.
