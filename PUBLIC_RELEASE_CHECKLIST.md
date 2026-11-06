# AimRoutine Tracker — Release blockers and evidence (6 November 2026)

This file records actual checks against the production GitHub Pages repository and Supabase project. **Do not mark production registration as open without testing the complete Auth flows.**

## Verified technical checks

- Supabase Paris `eu-west-3` is active. Cloud V7 uses four tables (`aim_profiles`, `aim_preferences`, `aim_sessions`, `aim_presets`) with authenticated-owner-only RLS and `ON DELETE CASCADE` references to `auth.users`.
- A live SQL test used the identities of the two existing accounts. Temporary sample rows were added for both users inside a transaction, an authenticated session for user B attempted cross-user reads, updates, deletes, cross-user insert and ownership transfer, and all forbidden operations returned zero rows or raised insufficient privilege. Own rows remained visible. The transaction was rolled back; no sample data persisted.
- Public Auth settings: Google and email providers enabled, email autoconfirmation **off**, and global `disable_signup=false`. **As of 6 November 2026, the activated `Before User Created` hook independently blocks new email registrations at the API with verified HTTP 403.** Global signup is still enabled to allow Google beta registration.
- The deployed account deletion endpoint returned HTTP **401** for requests without a valid user JWT and for a forged user JWT, even when `SUPPRIMER` was supplied. It runs with `verify_jwt=true` and derives account identity server-side. A **real positive Google deletion test after the simplified flow has not been performed**.
- The web account page keeps `SIGNUPS_READY=false`. Google beta login remains active; public email/password signup is not offered through the UI. **Real SMTP transport and email delivery passed on 6 November 2026**: a deliberately disposable Gmail plus-alias account signed up over Supabase Auth HTTP 200; it received no access session before verification; unconfirmed password sign-in returned HTTP 400; recovery request returned HTTP 200; the connected Gmail mailbox received both separate confirmation and reset messages. The exact disposable account was then deleted in a guarded transaction, and a fresh database query confirmed **zero test accounts remaining** and the two original accounts untouched. This verifies *sending/receiving*, not activation-link click, password update, or Outlook delivery.
- Added deterministic regression tests for two users, two independent browser data stores, offline training sessions, merge, favorite tombstones, account scoping and progress deletion. These mocks do not replace real authenticated browser testing.
- Site-quality automation validates JavaScript and local asset references, executes core tests and checks tracked text files for high-confidence secret patterns. Cross-browser tests cover Chrome, Firefox and mobile WebKit.
- Lighthouse measurement after responsive image and hero preload improvements: index performance **84**, training **89**, account **99**, at that single benchmark run. Performance can vary. Reports: https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42229697548
- Security Advisor still reports **Leaked Password Protection Disabled**. Supabase native leaked-password protection requires Pro+. The browser-side 12-character minimum/HIBP check is useful but does not enforce backend password policy.

## Owner-controlled operations not available to this connected toolset

### A. Rotate disclosed Google OAuth client secret (HIGH PRIORITY)

Google Cloud credentials cannot be changed with the connected Supabase or GitHub actions. A Gmail connection does not grant Google Cloud administration.

1. In https://console.cloud.google.com/auth/clients select the correct OAuth Web client.
2. Click **Add Secret** (Google's client-secret rotation feature). Both secrets remain valid temporarily. Store the new secret privately; never put it in chat, source code or public issues.
3. In https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/providers open **Google** and replace the old client secret with the new one. Preserve the existing client ID and callback URL.
4. Sign out and sign in with Google from a fresh browser/private window, verifying that AimRoutine receives the correct account.
5. On the Google client page **Disable** the old secret, retest Google login, then **Delete** the old secret.
6. Verify no credentials are present in the repository. The CI scanner supplements, but never replaces, rotation.

Official Google instructions: https://support.google.com/cloud/answer/15549257

### B. Close unwanted signup paths in Supabase Auth

The `disable_signup=false` flag allows Google beta onboarding, while the **activated and live-tested** `Before User Created` hook prevents new email users. The site also keeps `SIGNUPS_READY=false`. If the hook is disabled before release, direct email registration becomes possible regardless of the website flag.

- Review **Authentication → General** and the setting **Allow new users to sign up**. Disabling it globally blocks creation of new Google users as well as email users; existing sign-ins continue working. Decide whether limited Google beta onboarding must remain enabled.
- **COMPLETED:** `public.aim_beta_signup_gate` is configured as the active **Before User Created** PostgreSQL hook. This is server-enforced; no trigger on the managed `auth.users` tables was used.
- **COMPLETED:** live direct Auth signup with the project's disposable Outlook plus-address returned HTTP 403 with the exact beta-gate rejection message. Google provider remained enabled and SQL confirmed zero test users were created.
- When email signup is intentionally opened, configure policy and rate limits first and then explicitly allow new registrations on the server.

Docs: https://supabase.com/docs/guides/auth/general-configuration and https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook

### C. Confirm production email and password policy

1. **Server-side 12-character minimum is now empirically verified:** direct Auth API signup with an 11-character random password returned HTTP 422 and the 12-character candidate succeeded with a confirmation-required account. The disposable account was immediately deleted and SQL verified no probe accounts remain. Preserve this setting; review other available complexity options in Supabase.
2. Confirm mail redirects for `https://aimroutine-tracker.github.io/account.html` and its `?reset=1` variant.
3. Use a disposable email account to test: signup → confirmation mail → link → login → session → password reset request → reset mail → new password → old password fails → correct password succeeds → self-deletion. Do not paste verification links/codes/passwords into chat or logs.
4. Check delivery to Gmail and Outlook independently and verify SPF/DKIM / sender reputation where applicable. Custom Gmail SMTP may be unsuitable beyond low-volume beta.
5. Review **Authentication → Rate Limits** and **Bot Detection/CAPTCHA**, respecting free-plan limits; avoid deliberately exhausting production quotas.
6. Investigate the free-plan leaked-password limitation. Native HIBP enforcement cannot be assumed until upgraded or replaced with a genuinely server-enforced solution.

Docs: https://supabase.com/docs/guides/auth/password-security and https://supabase.com/docs/guides/auth/rate-limits

### D. Verify deletion and cloud synchronization using disposable accounts

- **Google self-delete**: sign in to a newly created disposable Google-linked user with no valuable records; type exactly `SUPPRIMER` and submit without another Google authentication; verify the Auth identity and four cloud table rows are gone. Never run this test against the owner's actual account.
- **Two-account browser test**: separate real browser profiles for A and B, with consent for cloud sync; test A/B separation, offline progress on two devices, merge after reconnection, favorite deletion propagation and local-backup recovery. The SQL/RLS test and JS mocked tests already passed but are not a substitute.
- Account deletion cannot remotely erase downloaded JSON backups or caches on other devices.

### E. Public release only after previous gates pass

1. Confirm OAuth secret rotation, disposable positive deletion, complete email confirmation/recovery, authenticated multi-device sync and security policy.
2. Fix any failed automated tests and recheck Supabase advisors.
3. Change `SIGNUPS_READY=false` to `true` in `account-v7.mjs` **only now**.
4. Deploy through GitHub Pages, repeat live fresh-browser tests, and verify email throttling and support mailbox `aimroutine-tracker@outlook.fr`.

**Current release decision: Do not open public email signups yet.** The blockers above require settings and an interactive Google/email account session not available through the connected actions.

## Live email test evidence (one-time, 6 November 2026)

- GitHub Actions run: https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42231604283 — success. The disposable password was random, ephemeral and never logged.
- Gmail delivered **Confirm your email address** and **Reset your password** (two distinct test messages received within seconds).
- SQL account cleanup verified the plus-alias does not exist in `auth.users`. The owner-created accounts were not modified.
- The confirmation/recovery links were not opened, so account activation, completing recovery and trying the changed password must still be tested from a fully interactive, authorized browser session. A second independent destination (Outlook) is also pending.

## Direct server-side password policy check (6 November 2026)

- GitHub Actions: https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42232428474 — HTTP 422 for a random 11-character password, response explicitly indicated **minimum 12**, and HTTP 200 for 12 characters with no authenticated session issued.
- One disposable account was created only in the accepted 12-character case. It was deleted with an exact email+UUID+recent creation+no-cloud-data SQL guard; a follow-up count confirmed exactly **two original users remained** and zero matching disposable password-policy accounts.
- This independently verifies server-side **minimum length**, not server-side compromised-password checking. The native leaked-password security warning remains.


## Additional hardening — 6 November 2026

### Atomic progress deletion and offline replay protection

- New migration: `supabase/migrations/20261106150000_cloud_reset_atomic.sql`.
- New PostgreSQL function `public.aim_reset_my_progress()` executes all per-user training-row deletes plus one reset marker update in a **single transaction**, using `SECURITY INVOKER` with the existing owner-only RLS rules. The function accepts no target user ID and is callable only by `authenticated`.
- The web client uses `supabase.rpc('aim_reset_my_progress')`; another offline device that reconnects sees the marker and discards old local sessions, presets and legacy V1 state before merging. Post-reset new sessions remain supported.
- Verified by a real Auth-role SQL call in an explicit transaction that was then rolled back. Inside that test the user's rows were cleared, a valid reset marker appeared, and post-rollback global row counts were unchanged. Live anonymous and invalid-JWT HTTP calls both received **401**.
- Deterministic two-user/two-device tests additionally cover an offline device retaining stale V1 and V2 sessions: they must not be reuploaded after a reset. **Real two-browser authenticated testing remains pending.**

### Beta signup Auth Hook enabled and verified (6 November 2026)

- New migration: `supabase/migrations/20261106153000_beta_signup_gate.sql` creates the provider-specific `public.aim_beta_signup_gate(event jsonb)` for Supabase's **Before User Created** Auth Hook.
- The function returns a **403** for newly created email/phone/unknown providers and allows new Google identities; it does not prevent existing accounts from signing in. It runs as `SECURITY INVOKER`, is callable by `supabase_auth_admin` only, and **cannot** be called by browser `anon`/`authenticated` roles. SQL tests verified those conditions.
- **ACTIVE:** the owner enabled the hook in [Supabase → Authentication → Hooks](https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/hooks) and verified the dashboard displayed `ENABLED`, schema `public`, function `aim_beta_signup_gate`.
- **LIVE TEST PASSED:** new email registration was rejected (HTTP 403, expected beta-gate message). Supabase's public settings still report Google provider enabled. Existing Google login and **actual new Google OAuth account creation** still require positive browser testing. When opening public email registration, deactivate or revise the beta gate and complete all remaining release checks.
- **API-side email beta restriction is now enforced.** The website flag `SIGNUPS_READY=false` remains a separate UI gate. Do not remove the hook or enable public email signups until verification/recovery, security controls and support are ready.

Official docs: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook

## Gallery image compression — 6 November 2026

- Compressed the Windows 2.9 Dashboard screenshot into `aimroutine-29-dashboard-preview.webp` **50,954 bytes**, compared with the original **504,594 bytes**. The Coach screenshot became **31,456 bytes** compared with **153,608 bytes** original.
- The homepage uses the previews in gallery cards; the full-resolution originals are preserved and loaded on demand when opening the lightbox via the gallery's enlarged image action.
- Added browser regression test for both dashboard and coach showing previews and full-size lightbox sources. Chrome suite result: **13 passed**, https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42238136923
- Updated the preview generation workflow to regenerate on original screenshot modifications, rather than only on first installation.
- Lighthouse after earlier responsive art and preload changes (single run): home **84**, training **94**, account **99** performance; gallery compression reduces bytes transferred and may not improve the synthetic page-performance score.
- GitHub Pages deployment of the optimized gallery: https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42238136691 — successful.


## Live Outlook delivery and support mailbox (6 November 2026, 15:18 UTC)

- Connected Outlook account is the project's official private support mailbox: `aimroutine-tracker@outlook.fr`.
- A genuine Gmail-to-Outlook support-contact message arrived in the official Outlook inbox.
- Ran a **single-use live Supabase Auth signup** to a disposable Outlook plus-address, with a random password held only in GitHub Actions job memory. CI run: https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42241728663 (**success**).
- Supabase signup returned HTTP 200 **without an authenticated session**, sign-in before confirmation returned HTTP 400, and password-recovery request returned HTTP 200.
- Independently verified that Outlook received **both** Supabase emails: `Confirm your email address` (15:18:06 UTC) and `Reset your password` (15:18:09 UTC). No verification links were opened, shared, or logged.
- The exact disposable account was deleted using a SQL transaction guarded by UUID, email, creation time, unconfirmed state and absence of app data. A final query returned **2 original Auth users, 0 Outlook test users**.
- Deleted the single-use GitHub Actions workflow and script to prevent accidental repeated account creation. Gmail and Outlook mailbox deliverability are now both **verified**. Confirmation/recovery link completion, live two-browser sync, Google account deletion and OAuth client secret rotation remain **pending**.

## GitHub Pages deploy queue (6 November 2026)

- The build and cross-browser/site-quality checks were successful, but run https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42238929206 failed in GitHub's Pages **deployment** step after staying in `deployment_queued` / `updating_pages` until its 10-minute timeout. This is a host deployment timeout, not a failing JavaScript/build test.
- Retried failed deployment job, which again timed out. Newer commits trigger another Pages deployment; **do not claim the latest site is live unless the corresponding deployment run concludes success**.

## Production email registration denial test (6 November 2026, 15:35 UTC)

- [GitHub Actions 42244394527](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42244394527): **success**. An attempt to create a disposable email/password account by calling production `/auth/v1/signup` returned HTTP **403** and the exact text `New email registrations are not available yet.`, proving that the **active** Postgres hook (not just the disabled web form) blocked it.
- Live `/auth/v1/settings`: Google provider remains enabled; a complete Google OAuth browser sign-in was **not** exercised by this test.
- SQL audit after the probe: **2 existing users**, **0** disposable beta-hook test users. The one-time workflow and script were removed from the repository to prevent accidental repeated production signup attempts.
- Supabase Security Advisor continues to report only `auth_leaked_password_protection`; native breached-password blocking is still not enabled. A 12-character server-side password minimum was independently verified earlier.
- GitHub Pages deployment [42242023471](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42242023471) succeeded on the latest pre-probe version. Subsequent docs/cleanup commits trigger additional deployment runs; confirm the newest run before claiming the very latest commit was published.

**Public release is still gated** by end-to-end confirmation/recovery, actual disposable Google deletion, authorized multi-browser cloud sync testing, anti-abuse/CAPTCHA configuration review and a consciously approved public signup policy. When ready, disable or replace `aim_beta_signup_gate` first, then change `SIGNUPS_READY` and verify both UI and API flows. OAuth client-secret rotation is deferred at the owner's request and remains a recorded security recommendation.

## Final pre-release validation evidence (6 November 2026)

- **Server-side beta signup hook:** direct production email registration returned HTTP 403 and the configured refusal message. Google provider is still enabled. See [live signup test](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42244394527).
- **Google OAuth initiation:** real Supabase Auth `/authorize?provider=google` returned HTTP 302 to Google's official `accounts.google.com` consent endpoint. This **does not verify** completing login with a real user. The same [live security suite](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42245054597) confirms 401 for unauthorized account deletion and progression reset.
- **Browser recovery:** a new test verifies that a mocked recovery deep link displays the new-password form, performs password-breach screening and sends exactly one Supabase password-update request. [Chromium regression](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42245226838) **14 passed**; a mock is not a real production password reset.
- **Browser compatibility:** [Chromium + Firefox + WebKit smoke suite](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42245226938) **40 passed, 2 skipped**; [site quality](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42245226933) successful; [GitHub Pages deploy](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42245225696) successful.
- **Database and user cleanup:** no new account was created by the blocked-signup test; SQL returned **2 pre-existing accounts, 0 temporary probe accounts**.
- **Abuse-control configuration:** Supabase Auth includes built-in rate limits, but this integration cannot inspect or update the project's exact [Rate Limits](https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/rate-limits) or [Attack Protection](https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/attack-protection) settings. A CAPTCHA requires a provider site key, private server secret and matching frontend token support; do not claim it is enabled without those. The native leaked-password security warning remains and requires an eligible Supabase plan. Client-side HaveIBeenPwned screening is an additional precaution, not backend enforcement.
- **Unfinished positive end-to-end cases:** Google sign-in with a disposable Google identity followed by confirmed server-side deletion; email confirmation token consumption, password recovery completion and new-password login; true two-account multi-browser offline/online sync. Existing-owner login secrets must never be used as destructive test inputs.
- **Launch decision: keep `SIGNUPS_READY=false` and the server-side beta gate enabled.** Opening public email signup also requires intentionally changing or deactivating the email-denial Auth Hook, approving the anti-abuse configuration and checking full end-to-end flows. The owner has explicitly deferred OAuth secret rotation; this is a documented residual risk rather than a completed security item.

## 8-character minimum — VERIFIED IN PRODUCTION (6 November 2026, 16:07 UTC)

- Owner saved Email provider settings: minimum **8**; required lowercase, uppercase, digit and symbol.
- [GitHub Actions 42249443981](https://github.com/aimroutine-tracker/aimroutine-tracker.github.io/actions/runs/42249443981) **passed** three real requests against production Supabase Auth: a 7-character password returned HTTP 422 with a minimum-eight error; an 8-character compliant password passed password validation and reached the beta Auth Hook (HTTP 403); an 8-character lowercase-only password was rejected by password policy (HTTP 422).
- Verified `auth.users` still has exactly **2** existing users and **0** disposable password-policy test accounts. Removed the single-use test and workflow to prevent repeated production requests.
- Account forms now specify `minlength=8`, show the four requirements in French/English and use the k-anonymity HIBP browser check. GitHub quality checks passed. The beta email signup gate remains active; public email registration has **not** opened.
- Passwords longer than eight characters are still recommended, especially unique passphrases; server-side leaked-password protection remains disabled under Supabase Free.
