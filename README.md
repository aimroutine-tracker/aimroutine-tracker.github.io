# AimRoutine Tracker — public project website

Bilingual FR/EN presentation on [GitHub Pages](https://aimroutine-tracker.github.io/).

## Current product presentation

[product.html](https://aimroutine-tracker.github.io/product.html) presents the locally verified Windows portable version 2.9: separate local profiles, rank-adapted routines, timers, result entry, charts, reviews and JSON match imports. Official Riot history synchronization and Riot Sign On remain disabled without production approval. The website offers no public desktop download.

Two genuine captures show the React production bundle running with an isolated SQLite profile named Alex. The profile is fictional; the files contain no real player history or credential. The images are lossless WebP conversions, with no visual modifications. The desktop interface is French; the presentation is available in both languages.

## Website behavior

- The landing page preserves its illustrative routine builder, fictional Training Insights and guided concept tour.
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
