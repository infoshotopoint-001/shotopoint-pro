# Shoto Point News — API and integration contract

The front end is a standalone, same-origin newsroom. API credentials, publisher feed tokens, social-platform tokens and database credentials must remain on the server; do not place private API keys in `newsroom-config.js`.

## Public endpoints

The routes below are the defaults configured in `newsroom-config.js`; the Shoto Point Node.js backend must implement them before live data can appear.

### `GET /api/public/shoto-point-news/articles`
Returns published articles only. Suggested response:

```json
{
  "articles": [
    {
      "id": 125,
      "slug": "shoto-point-production-announcement",
      "title": "Shoto Point announces a new production",
      "excerpt": "A concise editorial summary.",
      "category": "Shoto Point Movies",
      "image_url": "https://cdn.example.com/story-image.jpg",
      "author_name": "Newsroom Desk",
      "published_at": "2026-11-04T09:00:00+01:00",
      "featured": true,
      "content_html": "<p>Sanitised, approved article content.</p>"
    }
  ]
}
```

### `GET /api/public/shoto-point-news/articles/:id-or-slug`
Returns one published article using the same field names as above, optionally wrapped in `{ "article": { ... } }`.

### `GET /api/public/shoto-point-news/ticker`
Returns `{ "headlines": [{ "title": "..." }] }` or a string array.

### `GET /api/public/shoto-point-newsroom`
Returns externally aggregated headlines. The server should use authorised RSS feeds, APIs or publisher-approved integrations, preserve attribution, store the original publisher name and link, and avoid republishing full copyrighted articles.

```json
{
  "headlines": [
    {
      "source_name": "Vanguard",
      "source_key": "vanguard",
      "title": "Original publisher headline",
      "published_at": "2026-11-04T08:00:00+01:00",
      "url": "https://publisher.example/story"
    }
  ]
}
```

Expected sources: Vanguard, The Sun, BBC News, Fox News, Al Jazeera, CNN, Channels TV, NTA and Africa Magic TV. Availability depends on permission, a public feed/API, or a compliant aggregator. The page intentionally shows a feed-not-connected state rather than inventing headlines.

### `POST /api/public/shoto-point-news/newsletter/subscribe`
Accepts JSON: `{ "email": "reader@example.com" }`. Validate, deduplicate, record consent and provide an unsubscribe process.

### `POST /api/public/shoto-point-news/membership/register`
Accepts multipart form data including applicant fields and a passport image. Validate fields and file type/size, store the record securely, return a registration/member reference and an explicit pending/approved status. Do not treat the browser-generated preview slip as proof of approved membership.

### `POST /api/public/shoto-point-news/submissions`
Accepts multipart form data for a news submission: `title`, `category`, `author`, `email`, `location`, `summary`, `sourceUrl`, `tags`, `submissionDate`, `content`, and one or more `media` files. Return a submission reference and `pending_review` status. Editorial approval must be required before publication.

### `GET /api/public/shoto-point-production/updates`
Returns approved public production updates, for example `{ "updates": [{ "title": "...", "summary": "...", "url": "https://..." }] }`.

## Video and social links

Open `newsroom-config.js` and fill in:

- `productionUpdates.youtubeVideoUrl` — public YouTube video URL used for the embedded homepage and production-updates video preview.
- `productionUpdates.youtubeChannelUrl` — official Shoto Point Productions YouTube channel.
- `productionUpdates.facebookPageUrl` — official Facebook page.
- `productionUpdates.instagramProfileUrl` — official Instagram profile.

These values are blank intentionally because no official channel/page URLs were supplied with the request. Use URLs for accounts controlled by Shoto Point Productions. A direct YouTube video is embeddable; Facebook and Instagram profile links open the official pages. To show actual Facebook/Instagram post embeds, implement platform-approved embed/API integration server-side.

## Security and operations

- Use HTTPS in production.
- Keep database credentials and publisher API tokens on the server.
- Apply rate limits and abuse controls to registration, newsletter and article-submission routes.
- Validate MIME type and file size; virus-scan uploads; store them outside the executable web root or in managed object storage.
- Sanitise rich-text HTML server-side before saving and again before displaying.
- Add CSRF protection where cookie-based sessions are used.
- Restrict staff publishing/admin actions behind authentication and role checks.
- Keep an audit trail of edits, approvals and removals.
- Respect publisher terms and copyright; display short attributed headlines and links, not wholesale article copies.
