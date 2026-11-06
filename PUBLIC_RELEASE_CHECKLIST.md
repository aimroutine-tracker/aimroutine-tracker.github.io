# AimRoutine Tracker — Release blockers and evidence (6 November 2026)

This file records actual checks against the production GitHub Pages repository and Supabase project. **Do not mark production registration as open without testing the complete Auth flows.**

## Verified technical checks

- Supabase Paris `eu-west-3` is active. Cloud V7 uses four tables (`aim_profiles`, `aim_preferences`, `aim_sessions`, `aim_presets`) with authenticated-owner-only RLS and `ON DELETE CASCADE` references to `auth.users`.
- A live SQL test used the identities of the two existing accounts. Temporary sample rows were added for both users inside a transaction, an authenticated session for user B attempted cross-user reads, updates, deletes, cross-user insert and ownership transfer, and all forbidden operations returned zero rows or raised insufficient privilege. Own rows remained visible. The transaction was rolled back; no sample data persisted.
- Live public Auth settings: Google provider enabled, email provider enabled, email autoconfirmation **off**, **server-side signups currently allowed** (`disable_signup=false`). The last item is a security release blocker: a disabled UI signup button does not stop API signups.
- The deployed account deletion endpoint returned HTTP **401** for requests without a valid user JWT and for a forged user JWT, even when `SUPPRIMER` was supplied. It runs with `verify_jwt=true` and derives account identity server-side. A **real positive Google deletion test after the simplified flow has not been performed**.
- The web account page keeps `SIGNUPS_READY=false`. Google beta login remains active; public email/password signup is not offered through the UI. A real SMTP invitation reached the dedicated Gmail mailbox, but confirmation and password-reset delivery have not been validated end-to-end.
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

The last safe live check found `disable_signup=false`. The website's `SIGNUPS_READY=false` does **not** prevent direct API signups.

- Review **Authentication → General** and the setting **Allow new users to sign up**. Disabling it globally blocks creation of new Google users as well as email users; existing sign-ins continue working. Decide whether limited Google beta onboarding must remain enabled.
- To keep new Google users while denying email registration, configure a genuine server-enforced provider-specific signup restriction / verified **Before User Created** hook rather than treating the UI flag as security. Do not deploy a trigger against managed `auth.users` tables as a shortcut.
- Confirm the resulting public Auth settings and an actual rejected signup attempt before declaring registration closed on the server.
- When email signup is intentionally opened, configure policy and rate limits first and then explicitly allow new registrations on the server.

Docs: https://supabase.com/docs/guides/auth/general-configuration and https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook

### C. Confirm production email and password policy

1. In Supabase Auth settings set **minimum password length to at least 12** server-side; check available complexity options. The present client-side 12-character test can be bypassed using the REST Auth API.
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
