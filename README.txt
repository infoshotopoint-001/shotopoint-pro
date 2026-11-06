Shoto Point Production — API/CMS/Newsroom deployment note

The Admin Control Centre uses same-origin API requests by default. Keep API_BASE_URL blank in config2.js when the HTML website and Express API are deployed together on the same Vercel project. The previous hard-coded localhost browser URL is not suitable for a public website.

The backend requires a private JWT_SECRET and reachable MySQL credentials. Configure them in the hosting environment or a private .env file; do not put secrets in frontend JavaScript.

See API_AND_NEWSROOM_FIX_NOTES.md for installation, deployment and endpoint checks.
