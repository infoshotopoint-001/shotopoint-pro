# Shoto Point Production — Admin Publishing Update

This overlay connects the selected `index_admin.html` control centre to the existing Node.js/MySQL backend for three public-facing areas:

1. Team profiles
2. SYFM navigation and news categories
3. Shoto News articles

It preserves the current Shoto Point Admin design and uses the exact main files `index_admin.html` and `style2.css`.

## Install into the existing project

1. Stop the running Node process with `Ctrl + C`.
2. Extract this ZIP directly into the existing project root, for example:
   `C:\Users\USER\Documents\SHOTO POINT PRO`
3. Allow the included files to overwrite their matching project files.
4. Keep your existing `.env`, `uploads` folder, database and `node_modules` unchanged. This ZIP does not contain secrets or database files.
5. Start the app from the folder containing `package.json`:

   ```powershell
   npm start
   ```

6. Sign in at `http://127.0.0.1:5000/Adminlogin.html` and open `http://127.0.0.1:5000/index_admin.html`.

The server creates or updates the `team_members`, `syfm_site_settings` and `spp_news_articles` tables during startup using the existing database connection. The MySQL account configured in `.env` needs permission to create/alter tables in the `shoto_point` database.

## Team Management

Open **Team Management** in the Admin sidebar.

- Create, edit and delete team profiles.
- Set a profile's name, role, short biography, full biography, team group and display order.
- Upload a profile image through the authenticated `/api/admin/upload` endpoint, or provide an image URL.
- Choose whether a profile is published or hidden.
- Public Executive, Administrative and Senior team pages load active records from `/api/public/team`.
- The public home page's Team menu links to those database-driven team pages.

Only unmistakable starter placeholders from the previous seed list (for example `CEO Name` and `Co-Founder Name`) are removed during startup. Other existing profile records are preserved.

## SYFM Management

Open **SYFM Management** in the Admin sidebar.

- Edit each navigation label and destination URL.
- Toggle visibility.
- Move items up or down to change order.
- Add and remove navigation items.
- Edit the separate **JOIN SYFM** destination.
- Edit the News categories list (one category per line).
- Select **Save & publish SYFM** to store changes in MySQL.

The public `SYFM(2).html` page fetches `/api/public/syfm/navigation` and renders the saved menu, JOIN SYFM destination and News categories. `SYFM.html` redirects to `SYFM(2).html`; the main website's SYFM link points to the database-driven page.

## Shoto News Publishing

Open **Shoto News** in the Admin sidebar.

- Create, edit and delete articles.
- Set headline, optional URL slug, category, author, excerpt, article body and featured image.
- Upload the featured image through the authenticated media upload API.
- Mark an article as featured.
- Use the publishing states **Draft**, **Pending review**, **Scheduled** and **Published**.
- Scheduled articles are changed to Published when their scheduled time is due. The check runs when the admin list or public newsroom API is requested; the public News page refreshes periodically while open.
- Only Published, due articles are exposed through the public API.

The public `news.html` page reads published articles from `/api/public/news/articles`, and `news-article.html` renders each article by its slug. News categories are read from the saved SYFM category settings, so changing categories in SYFM Management updates the Shoto News category bar as well.

## API routes used

- `GET/POST/PUT/DELETE /api/admin/team` and `/api/admin/team/:id`
- `GET /api/public/team`
- `GET/PUT /api/admin/syfm/navigation`
- `GET /api/public/syfm/navigation`
- `GET/POST /api/admin/news/articles`
- `PUT/DELETE /api/admin/news/articles/:id`
- `GET /api/public/news/articles`
- `GET /api/public/news/articles/:slug`
- `POST /api/admin/upload`

Admin write routes require a valid bearer token from the normal administrator login.

## Verification

After installation, verify:

- `http://127.0.0.1:5000/api/health`
- `http://127.0.0.1:5000/index_admin.html`
- `http://127.0.0.1:5000/SYFM(2).html`
- `http://127.0.0.1:5000/news.html`

Use a test profile and test article first, then confirm they appear on the public pages before entering all production content.

This package has been syntax- and reference-checked in the build environment. It has not been connected to your private local MySQL instance from here; the live DB connection must be verified after you copy the update and restart your local app.
