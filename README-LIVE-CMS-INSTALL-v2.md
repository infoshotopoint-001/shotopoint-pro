# Shoto Point Production — Live CMS Integration v2 installer

This is a corrected, idempotent installer for the project in:

`%USERPROFILE%\Music\Shoto_Point_Production_HTML_JS_Node`

It replaces the earlier installer that stopped at the optional exact-text database startup check. This v2 installer does **not** require that brittle startup line and does not delete any Team records.

## Install

1. Stop the running Node process with `Ctrl+C`.
2. Extract the complete ZIP directly into the active `Shoto_Point_Production_HTML_JS_Node` folder in Music.
3. Open PowerShell in that folder.
4. Run:

```powershell
Unblock-File .\Install-SPP-Live-CMS-v2.ps1
Set-ExecutionPolicy -Scope Process Bypass -Force
.\Install-SPP-Live-CMS-v2.ps1
```

The installer creates a timestamped backup and preserves `.env`, `package.json`, `node_modules`, uploads and MySQL data. It uses the existing Team and CMS CRUD endpoints; mounts the MySQL-backed newsroom handler before legacy routes; supports the `syfm` public menu location; adds scheduled publishing and section publishing; and loads the live Admin workspace into `index_admin.html` without replacing its design.

## Restart and test

```powershell
npm start
```

In a second PowerShell window:

```powershell
curl.exe -i http://127.0.0.1:5000/api/health
curl.exe -i http://127.0.0.1:5000/api/public/newsroom
curl.exe -i "http://127.0.0.1:5000/api/public/cms/menus?location=syfm"
curl.exe -I http://127.0.0.1:5000/index_admin.html
```

Expected health response is HTTP 200 with `database: "connected"` and `mysql: true`. The newsroom is HTTP 200 JSON. The SYFM menu may return an empty `data` array until menu items are created/published from Admin.

**Important:** Publishing workflows must be tested while signed in as an administrator. An HTTP 200 from a public endpoint alone does not prove an authenticated save/publish action was persisted.
