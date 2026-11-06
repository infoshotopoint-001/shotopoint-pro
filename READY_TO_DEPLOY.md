# Shoto Point — ready-to-deploy setup

## What was repaired

- Membership forms now send their passport photograph with the field name the API accepts.
- The API also accepts the previous `passport` field name, so older saved copies of the form remain compatible.
- Successful SYFM and Shoto Point News registrations are saved to their respective MySQL tables and immediately open a printable registration slip with the portal brand and generated reference.
- The Admin Control Centre now displays SYFM and Shoto Point News applications together and approves/rejects them in the correct table.
- The SYFM portal masthead puts Shoto Point Productions on the left and SYFM on the right.

## Start locally

1. Copy `.env.example` to `.env` and enter a real MySQL connection plus a long `JWT_SECRET`.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:5000/api/health`. It must report `ok: true` and `database: connected` before testing registrations.

## Before publishing

Set the same environment variables in the hosting provider. For Vercel, also configure persistent R2 storage before accepting production uploads. Never add database passwords, JWT secrets, payment keys, or AI keys to browser JavaScript files.
