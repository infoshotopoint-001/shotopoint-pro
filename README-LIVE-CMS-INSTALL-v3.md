# Shoto Point Production – Live CMS repair installer v3

This update targets the existing project only:

`%USERPROFILE%\Music\Shoto_Point_Production_HTML_JS_Node`

It preserves `.env`, `package.json`, `node_modules`, MySQL data and existing Team records. It keeps the selected main Admin files and styling (`index_admin.html`, `style2.css`, `app2.js`, `config2.js`). It makes a timestamped backup before changing project files.

## What v3 repairs

- Adds the missing `cms_menus.slug` column to an existing database table, creates stable unique slugs for existing menu rows, and ensures `created_by` / `updated_by` columns are present.
- Adds a unique index for menu slugs. The migration is idempotent and runs during the server's existing CMS startup initialization.
- Reapplies the MySQL-backed newsroom route so SPP Original stories are read from published `cms_content_blocks` records.
- Keeps the SYFM menu location enabled, the CMS scheduled-publishing task, page-section publishing endpoint, and the existing live Admin integration.

## Install

1. Stop every running local copy of the SPP Node server with `Ctrl+C` in its PowerShell window.
2. Extract the **complete ZIP** directly into:

   `%USERPROFILE%\Music\Shoto_Point_Production_HTML_JS_Node`

   Allow the installer and the supplied integration assets to be extracted. Do not extract into `Documents` or a nested duplicate folder.
3. Open PowerShell and run:

```powershell
cd "$env:USERPROFILE\Music\Shoto_Point_Production_HTML_JS_Node"
Unblock-File .\Install-SPP-Live-CMS-v3.ps1
Set-ExecutionPolicy -Scope Process Bypass -Force
.\Install-SPP-Live-CMS-v3.ps1
```

4. Confirm the final line says `LIVE CMS UPDATE v3 INSTALLED SUCCESSFULLY.` If it stops with an error, copy the full error text; do not continue as though it installed.
5. Start the server from that same project folder:

```powershell
npm start
```

Keep that PowerShell window open while testing in a second PowerShell window.

## Verify

```powershell
curl.exe -i http://127.0.0.1:5000/api/health
curl.exe -i "http://127.0.0.1:5000/api/public/cms/menus?location=syfm"
curl.exe -i http://127.0.0.1:5000/api/public/newsroom
```

Expected:

- `/api/health`: HTTP 200 and database connected.
- SYFM menu endpoint: HTTP 200. An empty `data` array means the endpoint is fixed but no menu rows have yet been created with `location='syfm'`; add those through the Admin menu manager.
- Newsroom: JSON includes `sources.Shoto Point Production` and its note says published SPP CMS articles are read from MySQL. `sppItems` remains empty until an article has been saved and published in the CMS.

If the newsroom JSON still contains the message `this static-site starter does not write to local files`, the request is reaching an older server process or a different project copy. Stop the older process and launch `npm start` from the Music-folder project above.

## Database-only migration alternative

The ZIP also contains `SPP-Fix-CMS-Menu-Slug.sql`. Run it in MySQL Workbench after selecting the `shoto_point` schema only if you need to apply the menu schema repair independently. With the v3 installer, the same migration is applied automatically at server startup.

Do not share `.env`, MySQL passwords, JWT secrets, admin credentials or API keys in diagnostic output.
