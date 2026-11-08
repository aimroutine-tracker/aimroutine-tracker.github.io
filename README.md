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


## Web player workspace v6.0 — 2026-11-06

- Immersive session mode with fullscreen where supported (CSS fallback on iOS), optional audio cue, and **automatic exercise/break progression**. The timer never fakes score collection.
- Detailed session analysis by explicitly selected tool and scenario for 7/30/90 days or all history, training calendar and personal-best records. Coaches now avoid treating different scenarios as comparable.
- Programs of 7, 14 or 30 days with a weekly rest day, day-by-day exercise plans and completion based on the actual date, tool and skill of a recorded session.
- Local optional player profile: nickname, avatar, declared rank, mouse, DPI, game sensitivity, eDPI display, focus and preferred tool.
- Five local achievement badges based strictly on saved sessions, streaks and frequency, not fake global leaderboards.
- PWA install support and offline caching of the training UI's static assets after a first online visit. External Riot imagery does not work offline. Installation prompts vary by browser.
- A reversible FR/EN translation layer covers static player pages and the key dynamic controls.
- Portable JSON interface format `aimroutine-interchange-v1` to transfer data between web browsers and serve as an **integration contract** for a future Windows importer. **No Windows importer or synchronization is provided yet.** See [WINDOWS_INTERCHANGE_V1.md](WINDOWS_INTERCHANGE_V1.md).
- GitHub CI adds portable-format tests and browser smoke scenarios using Chromium, Firefox and WebKit, with a mobile viewport. The test results are separate from the published GitHub Pages deployment.


## Complete desktop Windows patch notes — November 6, 2026

The project-owner-provided historical source `PATCH-NOTES-AimRoutine-Tracker.md` is displayed in full at [changelog.html](https://aimroutine-tracker.github.io/changelog.html) with 18 version/history chapters, anchor navigation and an original Markdown download. This is the Windows desktop software change history from the 1.x era through **Windows 2.9.1**, and does not imply the **web AIM workspace 6.0** shares its feature inventory. Version 2.9.1 adds Windows icon integration and metadata corrections. The site still uses authentic **Windows 2.9** screenshots, explicitly labeled. No public Windows installer is available and production Riot Sign On / automatic matchmaking retrieval remain unavailable. The navigation, homepage, product page, releases page and updates page link to the original notes.

## Cloud V7 beta — 2026-11-06

The owner approved a $0/month Supabase Free project in Paris (`eu-west-3`), project ref `lmzswtzboobpokumxzhy`. Four owner-only RLS-protected tables were created; the current Security Advisor warns that native leaked-password screening is disabled on Free. `account.html` provides the optional account/backup prototype with sign-in, explicit opt-in, per-user browser storage and guest-history import. **Public email registration is gated in the website and by an active server-side Before User Created Auth Hook**, independently verified to reject new email accounts with HTTP 403; Google OAuth onboarding remains enabled for beta testing. Guest mode remains independent; no Riot Sign On or Windows cloud sync is included.

Cloud V7 account deletion: the deployed `delete-aim-account` Edge Function verifies the authenticated account and exact typed `SUPPRIMER` confirmation. Google-identity accounts do not need a second Google sign-in; password-only accounts must confirm their password with a recent sign-in. The four cloud tables cascade on Auth deletion. This simplifies UX but lowers protection on shared devices; no unattended account-deletion test is run. Google OAuth is enabled in limited beta, while public email/password registration remains gated.

Security verification on 6 November 2026: owner-only RLS policies and delete cascades confirmed in live Supabase; a read/update/delete attempt against another account's existing profile/preferences returned zero rows under the `authenticated` role. The remaining leaked-password warning is native Supabase Pro+ functionality; the site's free browser-only HIBP check does not fix backend enforcement. Email confirmation/reset link completion, true two-browser sessions and a disposable positive Google deletion test still require authenticated end-to-end interaction; native breached-password blocking remains unavailable on Free. The owner has deferred Google OAuth secret rotation. The server-side beta signup restriction and an eight-character complex password minimum were verified through the live Auth API. The official private contact is now aimroutine-tracker@outlook.fr. Bilingual legal pages, mock two-device sync and OAuth deletion regression tests, live JWT rejection probes, tracked-secret scanning, responsive images and Lighthouse benchmarking have been added. See [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md).

## Interface V18 — 2026-11-08

- Same reference-derived interface header and responsive navigation on every public route (not just the four original screen reconstructions).
- Routine cards open the real editable builder and actual session/timer controls in a styled dialog. No fake sessions, ranks or Cloud devices.
- Direct links to individual training panels activate the corresponding real tab.
- Sign-in and Cloud navigation follow the real account dashboard on the account page; unverified cloud connection is never shown with a green indicator.
- Core account and Cloud sync modules are untouched; V18 is additive UI behavior. No Riot production API integration is implied.

## V19 — connected reference UI (2026-11-08)

- The five-day training preview now uses the same pure routine generator as the actual workout editor, including tool-specific names, hints, durations, levels and skills.
- The Routines reference screen exposes every real tool (editable routines, programs, goals, insights, achievements, coach, profile, JSON backups) via the native live tab panels, without iframe or duplicate storage.
- Cloud account actions in the reference screen call existing authenticated account handlers, with guest actions disabled until sign-in.
- Progress 7/30/90/all controls drive the existing real analytics renderer, not illustrative charts.
- All training/Cloud/Supabase mechanisms stay unchanged; no Riot API claims.

## Auto Cloud — novembre 2026

- No new guest progress is persisted: the training preview is available, but account sign-in is required to save routines, sessions, profile and programs. Existing guest local data is preserved only for explicit migration.
- Cloud synchronization is enabled by default for **every verified account**; no enable/sync button or manual activation. Training syncs after changes (debounced), reconnect/focus, and every 45 seconds while active; the account portal also refreshes periodically.
- The verified user's browser storage is a scoped offline/retry cache, not a guest backup; failed uploads remain pending and are not presented as uploaded.
- Server ownership continues to be enforced by existing Supabase RLS. Public Riot APIs are unchanged.
