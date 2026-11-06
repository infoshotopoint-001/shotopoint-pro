# Shoto Point Production — Live CMS publishing integration

This is a **patch bundle** for the current Shoto Point Production Node.js/MySQL project. It is not a replacement application and it does not contain or overwrite your `.env`, database, `package.json`, uploaded media, administrator accounts, or the selected black-and-gold Admin design.

## What this update connects

The existing Admin entry point remains `index_admin.html` and the selected stylesheet remains `style2.css`.

The following Admin workspaces are switched from browser-local prototype saves to the existing authenticated Node.js/MySQL API:

- **Executive Overview:** fetches available metrics, CMS counts and administrator activity from the backend. Missing metrics are shown as `—`; it does not invent figures.
- **Website & Page Builder:** saves page and section blocks to `cms_content_blocks`; allows preview and publishing of eligible page content.
- **CMS Content:** Article, Page, Section, Header and Footer records; rich text; image/video/audio/PDF uploads; alignments; Draft, Pending review, Scheduled and Published statuses.
- **Shoto News Publishing:** news articles are CMS Article records in the `news` section, with category and excerpt metadata.
- **Team Management:** creates, edits, uploads, orders, hides/shows and deletes Team profiles through `/api/admin/team`.
- **SYFM Management:** stores the SYFM navigation items and URLs in `cms_menus` with `location='syfm'`.
- **Website Menus:** stores the requested public homepage navigation and dropdown structure in MySQL.

The public homepage reads published header menus and active Team profiles. `SYFM(2).html` reads the published SYFM navigation. `news.html` receives original SPP articles from the MySQL-backed newsroom endpoint. Individual SPP articles open through `news-article.html`.

Only published content is returned to public pages. Draft and Pending review records remain private. Scheduled entries remain scheduled until their specified time; the server checks for due entries every 30 seconds.

## Before installing

1. Make sure your active project folder is:
   `C:\Users\USER\Music\Shoto_Point_Production_HTML_JS_Node`
2. Confirm that this folder contains `server.js`, `package.json`, `index_admin.html`, `Adminlogin.html`, `app2.js` and `config2.js`.
3. Keep a separate backup of your project/database before changing a production system.
4. Stop the running server in its PowerShell window with `Ctrl+C`.

## Install on Windows

1. Download this ZIP.
2. Extract **the contents directly into**:
   `C:\Users\USER\Music\Shoto_Point_Production_HTML_JS_Node`
   The file `Install-SPP-Live-CMS.ps1` must sit beside `server.js` and `package.json`, not inside an extra nested folder.
3. Open PowerShell and run:

```powershell
cd "$env:USERPROFILE\Music\Shoto_Point_Production_HTML_JS_Node"
Unblock-File .\Install-SPP-Live-CMS.ps1
Set-ExecutionPolicy -Scope Process Bypass -Force
.\Install-SPP-Live-CMS.ps1
```

4. The installer creates a timestamped `_spp-cms-backup-*` folder inside the project, patches the existing `server.js`, updates the main Admin references, and installs the CMS/public rendering scripts.
5. Do not continue if the installer reports an error. Save the full error output and inspect it before retrying.
6. When the installer reports `LIVE CMS UPDATE INSTALLED`, restart the app:

```powershell
npm start
```

Keep that PowerShell window open while using the local website.

## Verify the install

Open a second PowerShell window and run:

```powershell
Invoke-WebRequest http://127.0.0.1:5000/api/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5000/api/public/newsroom -UseBasicParsing
Invoke-WebRequest 'http://127.0.0.1:5000/api/public/cms/menus?location=header' -UseBasicParsing
Invoke-WebRequest 'http://127.0.0.1:5000/api/public/cms/menus?location=syfm' -UseBasicParsing
Invoke-WebRequest 'http://127.0.0.1:5000/api/public/cms/content?section=home' -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5000/api/public/team -UseBasicParsing
```

Expected: health returns HTTP 200 with `ok:true`, `database:"connected"`, and `mysql:true`; the public menus/team/content routes return HTTP 200 JSON. The Newsroom response should contain `sppItems`. It is normal for `sppItems` to be an empty array until at least one original SPP News article has been saved with status **Published**.

Then hard-refresh the browser (`Ctrl+F5`) and open:

- Admin login: `http://127.0.0.1:5000/Adminlogin.html`
- Main Admin: `http://127.0.0.1:5000/index_admin.html`
- Public homepage: `http://127.0.0.1:5000/index.html`
- SYFM: `http://127.0.0.1:5000/SYFM(2).html`
- Shoto News: `http://127.0.0.1:5000/news.html`

## Suggested end-to-end checks

### Shoto News

1. Sign in to the Admin.
2. Open **Shoto News Publishing** or **CMS Content** and create an **Article**.
3. Set its website section to `news`, choose a category, enter a title and body, and set status to **Published**.
4. Save. Confirm it appears in the Admin list and in `/api/public/newsroom` under `sppItems`.
5. Refresh `/news.html`; the SPP story should appear. Open it to verify `/news-article.html?id=...` loads the full story.

### Team Profiles

1. Open **Team Management** and add a real profile with a name, role, group (Executive, Administrative or Senior), and photograph if available.
2. Ensure **Publish profile on public Team pages** is checked.
3. Save. Confirm `/api/public/team` includes the profile.
4. Refresh `/index.html`; the Team section should show active profiles. The detailed Team pages retrieve the same public API.

### SYFM navigation

1. Open **SYFM Management**. If the database does not yet have the SYFM menu rows, the Admin creates the requested Home, About, Vision, Programmes, Leadership, Public Affairs, Membership, Events, News, Gallery, Contact and JOIN SYFM entries.
2. Edit a label or URL and save.
3. Confirm `/api/public/cms/menus?location=syfm` reflects the change.
4. Refresh `/SYFM(2).html`. The menu should be rebuilt from MySQL while retaining the SYFM in-page navigation behaviour.

### Website pages and sections

1. Open **Website & Page Builder**.
2. Choose a page key such as `home`, `about`, `service`, `production`, `our-story` or `syfm`.
3. Create a Page or Section, enter its title and body, choose alignment and status, then save.
4. Publish it to make it visible. Future scheduled items remain scheduled until due.
5. Pages already instrumented with the public CMS renderer display records for their section. New standalone page keys can be previewed using `/cms-page.html?page=your-page-key`.

## Important scope and deployment notes

- This patch makes the listed CMS, Team, SYFM navigation and SPP News workflows database-backed. It does **not** turn every other Admin area (all analytics reports, payments, AI provider integrations, every media workflow, or the planned 100 external plugins) into a live integration. Those should be connected separately against their actual service APIs.
- Local changes appear on your local site at `127.0.0.1:5000`. They do **not** automatically update the public hosted `shotopoint.com` website. To publish to the hosted site, commit/deploy this patched project through your existing GitHub/Vercel/hosting workflow and configure the same database and persistent media storage securely in that hosting environment.
- The local `.env` is preserved. Do not upload it or share database passwords, JWT secrets, Admin IDs or Control Keys. Because credentials/secrets have previously been pasted into chat, rotate the MySQL application password and JWT secret privately before production use.
- The installer removes only exact known placeholder Team names from the starter seed. It does not delete other Team profiles or content.
- The installer creates a timestamped code backup. Still back up your MySQL database separately before production deployment.
