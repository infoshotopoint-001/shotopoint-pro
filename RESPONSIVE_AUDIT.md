# Responsive and entry-point audit

- Main page: `index_admin.html`
- Canonical CSS: `style2.css`
- Runtime scripts: `config2.js`, `app2.js`
- Login success target: `index_admin.html`
- Server static allowlist: HTML/CSS/JS and approved site assets only; backend, database, scripts, package metadata, `.env`, and dependencies remain blocked from static serving.
- Responsive breakpoints: 1200px, 950px, 650px, 380px, plus reduced-motion support.
- Responsive strategy: desktop fixed sidebar; tablet/mobile slide-in sidebar; tablet compact header; mobile stacked cards and builder panels; tables scroll within `.table-wrap`; modals constrained to viewport.
