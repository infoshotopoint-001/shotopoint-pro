# SPP Training & Meeting Pages

## Files
- `OnlineTrainingRecruitment.html` — training catalogue, recruitment enquiry form and embedded SPP meeting-room interface.
- `PodcastLiveSessions.html` — podcast/live session information and email-based session request.
- `PrivateMeeting.html` — Google Meet, TeamViewer Meeting, and SPP Meeting Room options; includes an embedded SPP room interface.
- `SPPMeetingRoom.html` — SPP-branded meeting-room front-end with local camera/microphone preview, screen-share preview, local room ID, and invitation URL copy.
- `spp-pages.css` — shared responsive black-and-gold visual theme.

## Install
Copy all five files into the root of the existing static website folder, next to `index.html`. Do not replace `index.html`, `SYFM.html`, or other existing pages.

Add or update links in the existing navigation/dropdowns:
```html
<a href="OnlineTrainingRecruitment.html">Online Trainings &amp; Recruitment</a>
<a href="PodcastLiveSessions.html">Podcast &amp; Live Sessions</a>
<a href="PrivateMeeting.html">Private Meeting</a>
```

## Important functionality notes
- The enquiry forms use `mailto:info@shotopoint.com`. They open the visitor's email app; they do not persist form submissions, send messages from the site, or confirm bookings. For production, connect them to a secure backend/CRM and protect them with anti-spam measures.
- Google Meet and TeamViewer Meeting open in a separate tab. Google Meet can be managed programmatically using its official API only after Google Cloud/OAuth setup. TeamViewer Meeting is not embedded as a guessed iframe because the service controls its own joining experience.
- The SPP Meeting Room is a **front-end prototype**, not a finished multi-user conferencing service. Browser camera/microphone and screen-share previews work locally where browser permissions/HTTPS allow them. They are not transmitted to another participant.
- To make SPP's proprietary meeting platform a live multi-user product, build/deploy a secure WebSocket signalling service, WebRTC offer/answer and ICE exchange, authenticated room membership, STUN/TURN infrastructure, access controls, privacy rules, and preferably a managed SFU/media server for group calls. Add `wss://` signalling only after that service exists.
- Avoid describing the SPP room as a functioning multi-user call platform until remote audio/video has been tested end to end by two separate devices on separate networks.
- Replace illustrative course and job-role descriptions with real SPP offerings and vacancies before publishing.
