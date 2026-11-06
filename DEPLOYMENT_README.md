# Shoto Point Production deployment

The application is served by Node.js 24 and Express. The same server serves approved HTML, CSS, JavaScript and media files and provides `/api/...` endpoints. A MySQL database is required for login, CMS, payments and persistent content.

Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PUBLIC_URL`, `CORS_ORIGIN`, `UPLOAD_DIR`, and payment provider secrets in the hosting environment. Do not commit real secrets. Start with `npm ci --omit=dev` and `npm start`. Run behind HTTPS and take backups before publishing production changes.
