# SPP Production Streaming & Photography Marketplace Refresh

This update changes the eight video/production categories to a dark cinematic streaming-library layout inspired by the supplied reference image. Photography is intentionally separate: it is now an art and photography marketplace.

## Streaming pages
- `Production.html` — all-category streaming home.
- `FilmProduction.html`
- `TelevisionProduction.html`
- `Documentary.html`
- `Commercials.html`
- `DigitalMedia.html`
- `PostProduction.html`
- `CreativeDevelopment.html`
- `TalentCasting.html`

These pages share `production-data.js`, `production.js` and `assets/production.css`. They include a featured title panel, Now Watching list, category chips, horizontal poster rows, search, sorting, player modal, quality choice, download and share controls.

## Photography marketplace
- `Photography.html` — separate SPP Art House marketplace.
- `photography-data.js` — curated artwork entries.
- `photography.js` — filtering, details, order enquiries and creator-access UI.
- `assets/photography.css` — separate marketplace styling.
- `assets/photography/` — original abstract SVG sample artwork cards.

Visitors can browse and request artwork. The sample listings are not actual SPP photographs or drawings, and no prices have been invented; they display `Price on request`. Replace them with SPP-owned or properly licensed original artwork, creator credits, sizes, print options, prices and fulfilment details before publication.

## Installing
Copy/merge the contents of this package into the existing SPP website root beside `index.html`. Merge the `assets` folder; do not delete or replace existing files. If the website already has files with these names, back them up first.

Update the existing Production dropdown in `index.html` to link to the matching category files. The Photography menu must link to `Photography.html`. The Production overview link should point to `Production.html`.

Suggested menu URLs:
- `Production.html`
- `FilmProduction.html`
- `TelevisionProduction.html`
- `Documentary.html`
- `Photography.html`
- `Commercials.html`
- `DigitalMedia.html`
- `PostProduction.html`
- `CreativeDevelopment.html`
- `TalentCasting.html`

## Add real videos and poster art
The current production catalogue contains clearly labelled DEMO PREVIEW records. They have no fake playable MP4 files. Add only approved SPP videos and posters to `production-data.js`. Each record can use:
- `poster`: local or authorised image URL.
- `watchUrl`: main MP4/HLS-compatible player source (HLS may require an HLS-capable player).
- `sources`: object such as `{ "480p": "...", "720p": "...", "1080p": "..." }`.
- `downloads`: matching downloadable files by quality.
- `youtubeUrl`: official YouTube watch link.

The browser player and quality menu work when real media URLs are provided. The available quality options are only those actually present in each record. Mobile browsers may open a media URL instead of saving it; use a server-issued download URL for protected files.

Do not place large videos into the Vercel deployment bundle. Use authorised media/object storage or a streaming CDN for long-form video. Adaptive HLS/DASH playback, transcoding, protected downloads, paid access and view analytics need a separate backend/media service.

## Photography ordering and creator approval
The current marketplace supports browsing, artwork details, sharing and order enquiries via email. It does **not** take payments; connect an approved payment gateway and a secure order API before describing an order as paid or complete.

The creator application UI is intentionally gated by server responses. To activate it, implement:

### `GET /api/photography/seller-status`
Return JSON such as:
```json
{ "loggedIn": true, "sellerApproved": true }
```
The server must derive both values from the authenticated SPP session and database. Do not trust query parameters, localStorage or client-supplied flags.

### `POST /api/photography/listings`
Accept multipart form data only from an authenticated, approved seller. Validate and scan the image, enforce file size/type limits, store it in approved media storage, and create a listing with `status: "pending_review"`. An SPP administrator must approve the listing before it appears in `photography-data.js` or the public API.

### Suggested order endpoint
Implement `POST /api/photography/orders` to create an order enquiry/order record, calculate price server-side, and create a payment session with the chosen payment gateway. Never trust a price submitted by the browser. Verify payment server-to-server before marking an order paid or releasing a full-resolution download.

## Demo content and intellectual property
Every poster/artwork in this package is original SVG placeholder art created for the interface and clearly labelled as a sample. The library does not contain real Shoto Point films or licensed third-party film posters. Replace sample assets and text before public launch. Only distribute media, photographs, drawings, fonts, music and performances for which SPP has the required rights and permissions.
