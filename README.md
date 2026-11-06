# Shoto Point News — multi-page newsroom

A standalone responsive editorial/news website for Shoto Point Productions. It carries a multi-page newsroom and membership platform built for the Shoto Point News brand and its entertainment and current-affairs coverage.

## Included pages

- `index.html` — newsroom homepage, featured story, top stories, breaking ticker, external source feed sidebar, production video preview and newsletter.
- `category.html` — separate category pages using `?category=`.
- `article.html` — full article reading page with a Read Full Story link from cards.
- `membership.html`, `join-shoto-point.html`, `register.html`, `registration-slip.html` — membership and registration flow with a red-header printable slip and passport image.
- `submit-news.html` — long-form, Word-style editor with formatting controls, source link, media uploads, local draft save/load and editorial submission workflow.
- `production-updates.html` — Shoto Point Productions video preview and official YouTube, Facebook and Instagram links.
- `search.html` — search results.
- `live.html` — compatibility redirect to Production Updates.

## Run locally

You can use any static web server. For example:

```bash
npx serve .
```

Open the local URL shown by the server. Running by double-clicking `index.html` may prevent some API calls because of browser file-origin restrictions.

## Brand and social configuration

Edit `newsroom-config.js` and paste the real official URLs into:

- `productionUpdates.youtubeVideoUrl`
- `productionUpdates.youtubeChannelUrl`
- `productionUpdates.facebookPageUrl`
- `productionUpdates.instagramProfileUrl`

No account URLs were provided with the request, so they are blank rather than guessed. The embedded video preview activates when a valid public YouTube video URL is supplied. Social buttons link to official channels when the URLs are configured.

## Backend requirement

The website can display clearly labelled preview stories and local registration-slip previews without a backend. Live articles, external publisher headlines, ticker items, confirmed membership registration, uploaded news submissions, newsletter sign-ups and production update cards require the API routes described in `API_CONTRACTS.md`.

External headlines from Vanguard, The Sun, BBC News, Fox News, Al Jazeera, CNN, Channels TV, NTA and Africa Magic TV must come from authorised feeds/APIs or a compliant aggregator. Keep source attribution and link readers to the original publisher.

## Important notes

- Membership slip generated without a working membership API is clearly marked as a local preview/pending confirmation; it is not proof of approved membership.
- Submit News drafts can be saved on the user's device, but submissions and uploaded media are not received by the newsroom until the API is live.
- The rich-text editor is a browser-side editor. The backend must sanitise content and securely validate and store uploads.
- Do not expose publisher API keys, database credentials or private tokens in the browser configuration.
