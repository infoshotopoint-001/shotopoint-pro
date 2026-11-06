# Shoto Point Production — HTML, CSS, JavaScript and Node.js

This version uses static HTML pages for the website and Admin Control Centre, browser JavaScript for interactions, and a Node.js/Express API for authentication, persistent database actions, uploads, payments and the newsroom feed. It contains no server-executed page templates.

## Start locally

1. Install Node.js 24 (or a compatible current LTS release).
2. Install and start MySQL.
3. Import `shoto_point.sql` into a database named `shoto_point`, or apply the database schema your deployment already uses.
4. Copy `.env.example` to `.env` and set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, and payment settings as required. Use a strong random JWT secret; do not commit `.env`.
5. In this folder run `npm install` once, then `npm start`.
6. Keep the terminal open and open `http://127.0.0.1:5000/` in Chrome. The server serves `index.html` and the other approved HTML/CSS/JS/media files as well as `/api/...` endpoints.
7. Open `http://127.0.0.1:5000/Adminlogin.html` to sign in, then use the existing Admin Control Centre.

## Important

- The browser must access the site through the Node server URL. Opening an HTML file with `file://` bypasses the API and will not provide login, database, media upload, payment or publishing functions.
- The Node.js server can serve static pages while MySQL is unavailable, but login, CMS data, media metadata, payments, and other database-backed APIs require MySQL to be running and the environment variables to be correct.
- AI providers require separate API credentials and billing. This conversion does not turn provider calls on automatically.
- Keep your original project ZIP and database backup until the new deployment has been tested.
- Never place database passwords, admin secrets or AI API keys in HTML, CSS or browser JavaScript.
