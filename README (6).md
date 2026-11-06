# SYFM Newsroom Multi-page Website

This package expands the original SYFM newsroom into a multi-page website.

## Pages
- `index.html` — newsroom homepage, featured story, top stories, external-news rail, category links and newsletter.
- `category.html?category=politics` — category page template (separate URL/page for each category).
- `article.html?id=ARTICLE_ID` or `article.html?slug=SLUG` — full article page.
- `search.html?q=term` — search results page.
- `membership.html` — membership information portal.
- `join-syfm.html` — Join SYFM membership landing page.
- `register.html` — membership registration form.
- `registration-slip.html` — printable red-header membership registration slip with passport photograph.
- `submit-news.html` — editorial submission page with Word-style rich-text editor and media upload controls.
- `live.html` — dedicated SYFM live-radio player page.

## Run locally
Run from this directory using a local web server; do not use `file://` for API-connected forms. For example: `npx serve .`

## API endpoints
Configure `newsroom-config.js` for your production backend. The default routes are:
- `GET /api/public/news/articles`
- `GET /api/public/news/ticker`
- `GET /api/public/newsroom`
- `POST /api/public/newsletter/subscribe`
- `POST /api/public/membership/register` (multipart form with passport file)
- `POST /api/public/news/submissions` (multipart form with rich-text HTML and media attachments)

A server must implement membership validation, duplicate checks, registration number allocation, secure passport storage, news submission storage, file-type/size validation, malware scanning, sanitisation, moderation workflow, authentication/anti-spam and audit logging. The static package cannot replace those backend controls.

## Membership slip mode
If the membership endpoint is unavailable, the form creates a clearly marked local preview slip using `sessionStorage`. It is not a confirmed registration. The live API should return `member_id` or `registration_number` and a status after successful submission.

## News editor mode
The editor supports text formatting, headings, font family/size, text colour/highlight, alignment, line spacing, lists, indentation, links, tables, horizontal rules, image URL and image uploads. Video URLs and file attachments are supported. Drafts can be saved in the current browser, or downloaded as an HTML draft. On submit, files and content are sent to the configured API. If the API is unavailable, the page says that the submission was not received; it does not falsely report success. Browser storage is not a substitute for server-side article storage.

## External publisher feeds
Use authorised RSS feeds, publisher APIs or a licensed aggregator through your backend. Show publisher attribution and link to original articles. Do not scrape, republish full articles or use publisher logos without the required rights.

## Before public launch
1. Connect the API routes and radio stream.
2. Test registration with the real membership database and confirm the slip status.
3. Test news submission and media uploads, file limits and moderation.
4. Add a privacy notice, retention policy and consent process.
5. Test every page on mobile and desktop.
