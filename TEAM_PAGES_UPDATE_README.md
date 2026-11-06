SHOTO POINT PRODUCTIONS — TEAM PAGE DESIGN UPDATE
=================================================

The Administrative and Senior Team pages have been rebuilt to use the same visual component structure as the root executive-team.html page.

Updated files:
- executive-team.css
- shoto_point_team_pages/administrative.html
- shoto_point_team_pages/senior-teams.html
- shoto_point_team_pages/team-executive.js
- shoto_point_team_pages/team-biography.html
- shoto_point_team_pages/team-biography.js
- shoto_point_team_pages/team-member.html
- shoto_point_team_pages/administrative.php (legacy route redirects to the new HTML page)
- shoto_point_team_pages/senior-teams.php (legacy route redirects to the new HTML page)
- shoto_point_team_pages/ceo.php (legacy route redirects to root executive-team.html)
- shoto_point_team_pages/team-member.php (legacy route redirects to the updated biography page)
- team-member.html
- team-member.js
- server.js (public team API now supports ?id=... lookups used by biography pages)

Page structure:
- Executive Team: root executive-team.html (existing reference design)
- Administrative Team: shoto_point_team_pages/administrative.html (two leader cards)
- Senior Team: shoto_point_team_pages/senior-teams.html (ten leader cards with departments)
- Administrative/Senior biography: shoto_point_team_pages/team-biography.html?group=...&member=...
- General CMS team biography: root team-member.html?id=...

The branch pages use executive-team.css and CEO/biography.css so their card and profile layouts follow the existing Executive Team and CEO Biography design. All pages include the shared Shoto Point preloader.

Validation performed:
- Node syntax checks passed for the updated JavaScript and server.js.
- PHP lint passed for updated legacy PHP redirect files.
- Fallback rendering verified: Administrative = 2 cards; Senior = 10 cards.
- Relative CSS, script, image and page references checked for the updated pages.

The team API requires the configured backend and database to display published names, biographies and portraits. If the API is unavailable, the branch pages still display the role and department cards using local fallback content.
