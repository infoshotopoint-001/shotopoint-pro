SPP NOVEL LIBRARY — INSTALLATION NOTES

Files in this package
- Novel.html: novel catalogue with search and multi-card layout
- ReadNovel.html: dedicated novel reader page with author/date, YouTube, share and PDF checkout buttons
- novels-data.js: shared catalogue data for both pages
- OurStories.html: redirects old story-menu links to Novel.html

Install
1. Copy Novel.html, ReadNovel.html and novels-data.js into the same folder as index.html.
2. Keep the referenced cover image files in that same folder, or update `cover` paths in novels-data.js.
3. Update the navigation in index.html so the Our Stories / Novels menu links to Novel.html.
4. Update each entry in novels-data.js with the actual SPP novel title, cover image, writer, site publication date, genre, description, YouTube URL and the complete authorised story manuscript.
5. Replace demo story copy. Every starter record is intentionally marked as demo content and is not represented as an official SPP publication.

PDF pricing and payment
The reader displays NGN 500 for Nigeria and USD 1 internationally. The front-end calls POST /api/novels/checkout with {"novelId":"...","currency":"NGN"|"USD"}. A server-side route still needs to be implemented to create the payment session, verify the payment provider's signed callback/webhook, and only then issue a short-lived protected PDF download URL. Do not put Paystack/Stripe secret keys in HTML or JavaScript. The front-end currently reports a clear message if the secure backend route is not connected; it does not claim that payment or download succeeded.

YouTube and share
If `youtubeUrl` is filled, the Watch button opens that URL. If it is blank, the button opens YouTube search results for Shoto Point Production and the title. Share uses the device share sheet where supported, and falls back to copying the page URL.

Publication data
No official SPP novel list or manuscripts were included with the supplied OurStories.html file. The sample records are for demonstrating the layout and flow only. Replace them with verified titles and manuscripts before deployment.
