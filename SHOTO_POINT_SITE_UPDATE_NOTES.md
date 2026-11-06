# Shoto Point Production website update

This package contains the website corrections requested for the Shoto Point Production project.

## Design and navigation

- Applied the SYFM menu's black, green and white visual palette across the website, with a restrained dark-navy accent.
- Added a shared branded Shoto Point Productions loading screen to the main site and administrative/public content pages. The SYFM page retains its own native preloader.
- Added consistent dropdown styling and green hover/focus states.
- Corrected the Team dropdown destinations and branch navigation.
- Matched the Administrative and Senior Team card treatment to the Executive Team design.

## Team pages

- Executive Team: two leadership cards (CEO and COO).
- Administrative Team: two leadership cards (Head of ICT and Head of Media).
- Senior Team: ten department-specific role cards, including PRO, Sound Engineer, Social Media Controller, Production Coordinator, Director of Photography, Video Editor, Graphics Designer, Scriptwriter & Story Editor, Production Manager and Technical Director.
- Public team pages retain API/database integration and render default role cards when team API data is unavailable or incomplete.

Names and photographs that have not been supplied remain editable placeholders. Replace the placeholder profiles with approved staff names, biographies and photographs before publishing the final team roster.

## Content and compatibility fixes

- Corrected common broken-encoding/mojibake characters in active website files.
- Corrected internal page destinations and replaced missing local asset references found during link validation.
- Preserved the existing Node/Express/MySQL application structure and existing page content.

## Validation performed

- JavaScript syntax checks passed for project JavaScript files outside excluded dependency and archive folders.
- PHP lint checks passed for the team PHP files (when PHP CLI was available).
- CSS parser checks returned no stylesheet syntax errors.
- Local HTML links and asset references passed the project path audit.
- No common mojibake markers were found in active HTML, CSS, JavaScript, PHP, JSON, Markdown or text files.

A full visual/browser QA pass was not confirmed in this environment. Review the website on desktop and mobile before production deployment.

## Deployment notes

For safety, the actual `.env` file is not included in this ZIP. The `.env.example` template is included.

1. Extract the ZIP.
2. Run `npm install` in the project folder.
3. Copy `.env.example` to `.env` and enter your own database credentials and a long random `JWT_SECRET`.
4. Import the database schema from the `database` folder into your MySQL database.
5. Start the application with `npm start`.

Do not publish database credentials, JWT secrets or other environment secrets in a public repository.
