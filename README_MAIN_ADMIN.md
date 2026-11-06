# Shoto Point Production — Main Admin responsive package (v3)

## Authoritative admin files
- `index_admin.html` — main Admin Control Centre; this is the selected design from the latest uploaded project.
- `style2.css` — canonical stylesheet used by the main page.
- `styles2.css` — synchronized compatibility copy; the main page does not depend on it.
- `config2.js` and `app2.js` — matching runtime files from the supplied project.
- `Adminlogin.html` — sends a successful sign-in to `index_admin.html`.

## Responsive layout
The supplied dark/black/gold interface has been retained. The responsive CSS now covers compact desktop/laptop (951–1200px), tablet/small laptop (up to 950px), phones (up to 650px), and narrow phones (up to 380px). The sidebar becomes a slide-in menu on tablet/mobile, header items are compacted to prevent crowding, dashboard grids stack, tables scroll inside their own wrappers, and builder panels/modal dialogs fit the viewport.

## Local run
1. Keep your existing private `.env` file; do not replace it with an example file.
2. From the project root, run `npm install` if needed, then `npm start`.
3. Open `http://127.0.0.1:5000/Adminlogin.html`. After sign-in, the page redirects to `http://127.0.0.1:5000/index_admin.html`.
4. Check `http://127.0.0.1:5000/api/health` for the API and MySQL health response.

## Verification and limits
- HTML entry points and local asset references checked.
- `app2.js`, `config2.js`, and `server.js` pass Node syntax checks.
- Stylesheet brace balance and CSS parsing checked.
- ZIP integrity checked.
- This package cannot verify your local browser, MySQL service, credentials, or device display remotely. Test the page on your actual desktop/tablet/phone after installing.
- Existing project features and backend APIs are retained. Workspaces that are still implemented as local browser drafts or placeholders are not represented as live API operations.
