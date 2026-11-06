# SYFM, CMS and Page Builder Update — v5.1

## SYFM public navigation

1. Home
2. About
3. Vision
4. Programmes
5. Leadership
6. Public Affairs
7. Membership
8. Events
9. News
10. Gallery
11. Contact
12. JOIN SYFM (primary call to action)

The `News` page exposes these sub-navigation categories in this order:

All headlines, Nigeria, Politics, Celebrities, Movies & Film, Actors, Musicians, Talents, Football, Media, Tech, World, SPP Originals.

## CMS content types

- Article
- Page
- Section
- Header
- Footer

Content alignment options: right, left, top, bottom, top right, top left, centre, bottom left, bottom right.

## Visual page builder components

Header, hero, text, image, video, audio, section, page, cards, columns, rows, image gallery, news feed, blog, article feed, document, social links, URL link, comments and reactions.

Text formatting: font family, font size, bold, italic, underline, left/centre/right paragraph alignment, lists and links.

Media insertion: local image, video, audio and document attachment preview.

Post engagement: Like, Comment, React and Share with local demonstration counters. Production use requires authenticated APIs, moderation, rate limiting, abuse prevention, persistence and privacy controls.

## Prototype limitations

This update remains a standalone browser prototype. Local media object URLs are temporary. SYFM page editing, CMS draft storage, publishing, media uploads and post interactions are not connected to a live SYFM or Shoto Point backend.


## v5.2 website main navigation

- Home
- About
- Service (dropdown)
- Production (dropdown)
- Team (dropdown)
- Our Webs (dropdown)
- Our Story (dropdown)
- Contact

Starter dropdown entries are included and editable in Website Menus. The supplied labels are suggestions because the final submenu names were not specified.

## v5.2 content publishing status

Allowed publishing states: Draft, Pending review, Scheduled, Published.

## v5.2 system indicator and administrator greeting

A pulsing green dot is shown only on a successful backend health check; otherwise it stays grey. The administrator greeting uses the name and role in `config.js` until an authenticated backend session supplies them.
