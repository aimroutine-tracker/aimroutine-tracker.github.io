# AimRoutine Tracker — public project website

Bilingual FR/EN presentation on [GitHub Pages](https://aimroutine-tracker.github.io/).

## Current product presentation

[product.html](https://aimroutine-tracker.github.io/product.html) presents the locally verified Windows portable version 2.9: separate local profiles, rank-adapted routines, timers, result entry, charts, reviews and JSON match imports. Official Riot history synchronization and Riot Sign On remain disabled without production approval. The website offers no public desktop download.

Two genuine captures show the React production bundle running with an isolated SQLite profile named Alex. The profile is fictional; the files contain no real player history or credential. The images are lossless WebP conversions, with no visual modifications. The desktop interface is French; the presentation is available in both languages.

## Website behavior

- The streamlined landing page centers authentic screenshots, a fictional routine builder and Training Insights, with nine focused sections.
- Dashboard and My Coach gallery tabs show current app captures. Routines and Statistics gallery views remain explicitly conceptual.
- The new product page provides keyboard-operated image tabs, enlargement, Escape to close, language switching and reduced-motion support.
- No account connection, training persistence, analytics collection or match-data request was added. The shared language switch stores the existing language preference only.
- Runtime data is not inferred from the marketing images. Public web examples remain illustrative.

## Verification

Desktop 2.9: 108 unit/integration tests, six headless UI scenarios and a packaged Electron/SQLite smoke check. Website: FR/EN, tabs and keyboard, image enlargement and Escape, reduced motion, landing links/gallery and layouts at 1440, 768 and 390 pixels; no JavaScript or asset errors in those checks.

## Files updated for 2.9

- product.html, product-v29.css, product-v29.js: current software presentation.
- index.html, release-v29.css: new version entry point and updated capture/status content.
- aimroutine-v16.js: enlargement of the active authentic gallery image.
- aimroutine-29-dashboard.webp, aimroutine-29-coach.webp: actual app captures with a fictional profile.

## Deployment and protected content

GitHub Pages publishes the main branch at the repository root. Confirm the matching Pages deployment completes; a source commit alone does not prove publication.

Keep riot.txt (Riot URL-ownership verification), privacy.html and terms.html unchanged unless the owner requests a relevant change. URL ownership verification does not mean Riot product approval.

Never commit keys, credentials, tokens, private match histories or .env files. Never present the web examples as live Riot data, create a fake download button or guarantee rank gains.

## Website 3.3 refresh — 2026-11-05

- Unified site navigation and responsive styles across all public pages.
- Home reduced from 15 to 9 sections; existing routine and Training Insights demos remain intact.
- Dashboard and My Coach are authentic 2.9 screenshots; gallery captions explicitly mark the other two panels as conceptual.
- Added [updates.html](https://aimroutine-tracker.github.io/updates.html) with verified feature status, limited history and public GitHub issue feedback (not private support).
- Riot API page is a nonfunctional and consent-based integration proposal. No actual OAuth, Riot login or match sync is enabled.
- No verified public Windows installer is hosted on the site.

Website source is static, bilingual, hosted on GitHub Pages. No credentials, client secrets, live player data or third-party tracking scripts are necessary for website demos.


## Web player workspace v5.0 — 2026-11-06

The live web workspace at [training.html](https://aimroutine-tracker.github.io/training.html) supports editable exercise plans (tool, name, duration, hints), ordered steps, optional breaks, manual timer, local favorites, weekly targets, streaks, accuracy trends, rule-based transparent coaching and JSON import/export.

- Training history from the earlier web v1 localStorage key is automatically imported on first load into v2. The old key is not removed unless the user deliberately clears local data. Previous unknown training tools are labelled **Non précisé**.
- All data is browser-local; no API calls or accounts, no live Riot data, no background sync. User-provided scores must be compared on similar scenarios.
- [releases.html](https://aimroutine-tracker.github.io/releases.html) distinguishes web availability from Windows 2.9 local screenshots and planned Riot features. There is **no public Windows installer**.
- Navigation across pages is grouped into four primary links plus an Explorer dropdown, with mobile equivalents.
- Four overlapping shared visual stylesheets were consolidated to site-shared-v5.css to reduce requests; page-specific styles are retained.
- GitHub Actions site-quality workflow checks JavaScript syntax, internal links/assets and Node unit tests for the training model. The repository still requires real-browser manual or automated acceptance testing prior to claiming the entire UX is production verified.
- Riot website/media assets are credited and served externally. Riot product approval is not implied.

The earlier Website behavior section above described the landing-site demos before web v5.0; the separate active workspace now persists user-entered training history in localStorage only.

## Official application logo — 2026-11-06

The official AimRoutine Tracker logo supplied by the project owner has been added unchanged in appearance as `aimroutine-logo.png` (losslessly optimized PNG, 128 × 128, transparent background). All HTML pages use it in the navigation bar and browser favicon, including the 404 and releases pages. The web manifest points to the same image. The shared footer branding also uses this icon.
