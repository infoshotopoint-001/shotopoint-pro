# Shoto Point Production — Digital Operations Centre v5.2

A standalone, responsive front-end starter prototype for the Shoto Point Production digital operations platform. This v5.2 update adds the requested hierarchical public website navigation, editable dropdowns, exact publishing workflow statuses, named administrator greeting and an API-health-driven pulsing indicator.

## Quick start

1. Extract the ZIP folder.
2. Open `index.html` in a modern desktop or mobile browser.
3. For a local web-server preview (recommended), run one of the following from this directory:

   **Python**
   ```bash
   python -m http.server 8080
   ```
   Then visit `http://localhost:8080`.

   **Node.js** (if `serve` is installed)
   ```bash
   npx serve .
   ```

No build step, package installation or database is required for the front-end demo.

## What's included

- Executive overview with sample KPI cards, chart range filters, content performance, storage/bandwidth indicators and activity panels.
- Website page-builder prototype with the Home / About / Service / Production / Team / Our Webs / Our Story / Contact navigation and dropdown preview, plus an expanded block palette (header, hero, text, image, video, audio, page, section, cards, columns, rows, gallery, news, blog, articles, document, social links, URL links, comments and reactions), inline editable text, bold/italic/underline, font family/size, text positioning, media attachment, desktop/tablet/mobile previews and local draft persistence.
- SYFM Management editor with Home, About, Vision, Programmes, Leadership, Public Affairs, Membership, Events, News, Gallery, Contact and JOIN SYFM navigation. Selecting News displays the supplied headline categories: All headlines, Nigeria, Politics, Celebrities, Movies & Film, Actors, Musicians, Talents, Football, Media, Tech, World and SPP Originals.
- CMS editor with Article, Page, Section, Header and Footer content types; nine requested alignment choices; rich text, image/video/audio/document insertion, and reusable content block controls.
- Demonstration post engagement controls in builder news/blog/article blocks: Like, Comment, React and Share, with local demo counters.
- CMS content workspace with Draft, Pending review, Scheduled and Published states; hierarchical website menu designer with editable submenu labels; visitor-news moderation, SEO/social preview and scheduling calendar.
- Media Library with file picker, local image/video/audio/document handling and sample asset gallery.
- Video Management with playable sample video, catalogue and featured placement workflow.
- Production Hub, SYFM management, Team Management, Live Events and Creator Community.
- Interactive analytics range selector and sample CSV export.
- Payments and revenue views with explicitly fictional transaction data.
- SPP AI Creative Studio with AI image/video/audio/script/design/post-production tabs, provider selector, demo job queue and generation history.
- A 100-entry plugin and integration catalogue, searchable and filterable by category, with configuration briefs.
- Developer Studio snippet editor, video-editing timeline concept and system/security overview.
- Responsive sidebar and mobile layout.
- API health indicator in the header and sidebar: a pulsing green light is shown only after the configured backend health endpoint returns a healthy response.
- Administrator greeting and profile name configurable in `config.js` (defaults to the administrator name shown in the supplied screenshot; edit `ADMIN_NAME` if you need to correct or change the spelling).

## Prototype behaviour and limitations

This is a **front-end prototype**, not a modification of the existing Shoto Point Production application. The original application source code and backend/API documentation were not provided with the dashboard screenshots.

The following items still require a backend/API connection and are not represented as live merely because the interface is open:

- Dashboard metrics, analytics, revenue, audience numbers, storage and bandwidth figures.
- Publishing, scheduling, moderation, payment and transaction operations.
- AI generation jobs. The Generate button creates a local demonstration job; it does not call OpenAI, Gemini or another provider.
- Plugin connection buttons. Configuration screens collect a local setup brief; they do not authenticate or connect services.
- Uploaded media. Selected image, video, audio and document files can be previewed or inserted locally during the current browser session but are not transferred to a server. Blob URLs are temporary and may not survive a browser restart.
- Page-builder draft and menu edits. These use browser `localStorage` and are not published to the public website.
- Video editing timeline and desktop editor hand-off. The timeline is a workflow mock-up, not a non-linear editor or renderer.
- SYFM radio and live event stream controls. These are interface examples, not live broadcasts.

Rich-text formatting uses browser editing commands and is intended as a functional prototype; a production builder should replace this with a maintained editor framework and server-side HTML sanitisation. Likes, comments, reactions and shares only update local demo counters; they do not create public posts or social-network activity.

The sample video URL is a public MDN test clip. Sample imagery uses remote Unsplash image URLs. An internet connection is needed for those remote images and the optional Google Fonts stylesheet; the core interface and local interactions do not depend on a UI framework.

## API health and administrator configuration

Edit `config.js` to set `API_BASE_URL`, `API_HEALTH_PATH`, `ADMIN_NAME` and `ADMIN_ROLE`. The green header/sidebar indicator requires a successful API health response. An unconfigured or unreachable API remains grey; the application does not falsely claim that a backend is live. Keep secrets server-side and inject authenticated administrator identity from the server in production.

## Before production deployment

1. Provide the actual existing Shoto Point source project so that working features and current styles can be merged rather than replaced.
2. Confirm the backend stack, hosting environment, database schema and existing routes.
3. Add authenticated server-side API services for CMS, media, website publishing, analytics, payments, community, events and SYFM.
4. Add protected role-based access, audit trails, CSRF protections, input validation, rate limits and secure session handling.
5. Store provider secrets in a server-side secret manager or encrypted environment configuration. Never expose API secrets in browser JavaScript or commit them to Git.
6. Implement OAuth consent, least-privilege scopes, signed webhook verification, retry policies, usage limits and provider-specific health checks.
7. Validate vendor API availability, pricing, usage rights, account permissions and region availability before activating an integration.
8. Add real analytics event instrumentation, media transcoding/storage/CDN services, backups and monitoring.
9. Test accessibility, mobile responsiveness, browser compatibility, security and deployment rollback.

## Directory map

```text
spp-digital-operations-centre-v5.2/
├── index.html
├── config.js
├── styles.css
├── app.js
├── README.md
└── docs/
    ├── INTEGRATION-ROADMAP.md
    └── SYFM-CMS-PAGE-BUILDER-SPEC.md
```

## Data and persistence

Small demo edits are kept in browser `localStorage` under keys prefixed with `spp:`. Clearing browser storage resets the local demo. No user account, server database, external analytics or payment account is accessed by this prototype.
