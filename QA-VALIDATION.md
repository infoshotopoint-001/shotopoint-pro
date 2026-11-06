# Validation notes

The patch bundle was checked in the build environment:

- `node --check` passed for `server.js` after simulating the installer changes.
- `node --check` passed for `newsroom.js`.
- `node --check` passed for `spp-cms-live.js`.
- `node --check` passed for `spp-cms-public.js`.
- Admin/public HTML script and stylesheet references were checked against the package contents.
- The install bundle is designed to preserve `.env`, `package.json`, the MySQL database and uploaded assets.

Not run: the PowerShell installer on the user's Windows computer; live database writes against the user's private MySQL instance; public hosting deployment. Those require running the installer and checks in the user's local environment.
