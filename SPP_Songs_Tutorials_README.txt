SPP SONGS & TUTORIALS — INSTALLATION NOTES

PACKAGE CONTENTS
- Songs.html — searchable song/music catalogue
- ReadSong.html — dedicated song page with artist/writer credits, release date, lyrics, YouTube/listen actions, share and paid-download UI
- songs-data.js — song records consumed by the catalogue and reader
- Tutorials.html — searchable tutorials catalogue
- ReadTutorial.html — dedicated tutorial page with instructor details, learning objectives, lesson notes, YouTube, share and resource checkout UI
- tutorials-data.js — tutorial records consumed by the catalogue and reader
- Image assets copied from the available SPP project so demo cards show images

INSTALLATION
1. Back up your existing website folder before changing files.
2. Copy Songs.html, ReadSong.html, songs-data.js, Tutorials.html, ReadTutorial.html and tutorials-data.js into the same root folder as index.html and the other SPP HTML pages.
3. Copy the included image assets into that same folder if those filenames are not already present. If your site keeps images in a different folder, update the cover paths in both data files.
4. In index.html's Our Stories menu, point Songs to Songs.html and Tutorials to Tutorials.html. The new pages already link to one another and to Novel.html.
5. Replace all entries marked isDemo:true with the official SPP song and tutorial information. For songs, update title, artist, writer, release date, genre, duration, cover, audio URL, YouTube URL, lyrics and authorised download asset. For tutorials, update title, instructor, publication date, category, level, duration, cover, YouTube URL, objectives, lesson content and approved resource file.

DEMO-CONTENT WARNING
All catalogue entries are sample/demo records created to demonstrate the layout and interactions. They are NOT claimed to be official SPP songs or tutorials. Do not publish them as the actual SPP catalogue. Empty publication dates are shown as "Publication date not set"; there are no invented release dates.

PAYMENTS AND DOWNLOADS
The front-end displays the requested sample prices of NGN 500 in Nigeria and USD 1 internationally. It calls these proposed backend endpoints:
- POST /api/songs/checkout with {"songId":"...","currency":"NGN"|"USD","productType":"song-download"}
- POST /api/tutorials/checkout with {"tutorialId":"...","currency":"NGN"|"USD","productType":"lesson-resource"}

These server routes are NOT included in this HTML-only package. Until the backend endpoints, payment provider, webhook verification and protected file-delivery logic are built and tested, the pages will show a message that checkout is not connected and will not claim that payment has succeeded. Never put payment secret keys in HTML or browser JavaScript. Only release paid downloads after verifying payment server-side.

YOUTUBE, AUDIO AND SHARING
- Enter a verified YouTube URL for each song/tutorial. If empty, Watch/Listen opens YouTube search results for the SPP title.
- Put audio files on your approved hosting/storage and set audioUrl. An HTML audio player appears on the song detail page when an audio URL is supplied.
- Share buttons use the device share sheet where supported and can fall back to copying the page URL.
- Tutorial pages embed a supplied YouTube URL when it is a recognised YouTube watch/short-link/embed URL; they also provide a button to open YouTube.

DESIGN
Black/gold SPP styling, shared navigation, responsive cards, mobile menu, search filters, detail pages and footers are included. Google Fonts require an internet connection; system fonts are fallback-safe.
