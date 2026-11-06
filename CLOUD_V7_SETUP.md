# AimRoutine Tracker Cloud V7 — Deployment checklist

**Status (November 6, 2026):** Supabase project `lmzswtzboobpokumxzhy` is ACTIVE_HEALTHY, hosted in Paris (`eu-west-3`), under organization AIM Routine Tracker. Free project cost quoted $0/month and approved. Migration `cloud_v7_initial` applied with four owner-only RLS tables. The current Supabase Security Advisor reports one **leaked-password protection disabled** warning: native checking requires Pro+, and browser-only screening cannot clear it.

## Required before public signup

1. Open https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/url-configuration
2. Set Site URL to `https://aimroutine-tracker.github.io/`.
3. Add allowed redirects `https://aimroutine-tracker.github.io/account.html` and `https://aimroutine-tracker.github.io/account.html?reset=1`.
4. Verify confirmation and recovery e-mails with real test users, and check Supabase Auth email limits.
5. Test the already-deployed full account deletion with a disposable account. Private contact: aimroutine-tracker@outlook.fr.
6. Complete authenticated end-to-end tests with two distinct accounts, including cross-account read/update/delete rejection and offline conflicts.
7. Only then enable `SIGNUPS_READY` in `account-v7.mjs`.

## Current implementation

- `cloud-client-v7.mjs` uses Supabase JS SDK v2.119.0 with only the **public publishable** key, no service-role keys.
- `account.html` provides sign-in, optional sync activation, manual sync, explicit guest-history import, separate cloud progress and permanent account deletion, plus password-reset/registration screens. Public email registration is gated in the UI, not in the live Auth API.
- `training-entry-v7.mjs` loads guest/local mode when not authenticated and account-scoped storage when signed in, synchronizing before v5/v6 modules load. Changes queue cloud uploads if opted in.
- `cloud-sync-v7.mjs` stores sessions and favorites by ID, soft-deletes removed favorites, and handles profile/goal fields. Robust real-world conflict testing still needed; retain JSON exports.
- Original local keys: `aimroutine_web_training_v2` for sessions, favorites, weekly goal and `aimroutine_player_extensions_v1` for V6 player profile/program. Guest data is not automatically uploaded to a new account.
- Four RLS-protected tables (`aim_profiles`, `aim_preferences`, `aim_sessions`, `aim_presets`) own rows by `auth.uid()`. The `anon` role has no table privileges.
- Cloud is not Riot Sign On and not connected to the Windows 2.9.1 application.

Do not state cloud registration is generally available until all steps above are completed.

## Progress: deletion endpoint

- Edge Function `delete-aim-account` deployed with **verify_jwt true**, `@supabase/server@1.9.2` with `auth:'user'`, and no administrative credentials in public JS. It validates the user JWT and account identity, bypasses recent-sign-in checks for Google-linked accounts but requires a recent sign-in for password-only accounts, then calls `auth.admin.deleteUser(user.id)` using the server-provisioned admin client. Database foreign keys cascade to all four training tables.
- Account UI now requires the current password plus typed `SUPPRIMER` and a final confirmation. No account is deleted except by a valid signed-in user explicitly submitting the form.
- **Needs E2E**: signed-in deletion test must confirm cascading rows, session invalidation, old credentials rejected, and guest data retained. JWT access tokens can remain valid until expiry; short token lifetimes are recommended.
- Owner said Site URL/redirect allowlist is configured; direct Supabase Auth dashboard settings are not exposed by connected management tools, so actual settings and confirmation email delivery are not independently verified.
- Password-reset request is now enabled for existing accounts (still subject to Supabase SMTP restrictions); public signups remain disabled.

## Zero-cost path: Google OAuth + dedicated Gmail SMTP (small beta)

No paid domain required. The existing public web origin stays `https://aimroutine-tracker.github.io`. All platform free tiers have usage and anti-abuse limits; this is **not** a guaranteed forever-free scalable production mail system. Keep signup gates CLOSED pending verified operations.

### Google OAuth (separate from Gmail SMTP)

1. In the free Google Cloud console, configure Google Auth Platform branding, Audience and scopes (`openid`, email, profile). Keep scopes minimal.
2. Create an OAuth client of type **Web application**.
3. Authorized JavaScript origin: `https://aimroutine-tracker.github.io`.
4. Authorized redirect URI (the Supabase callback): `https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/callback`.
5. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable the Google provider. Paste Client ID and **Client secret in the Supabase dashboard only**, never GitHub or chat.
6. Verify the browser login, return to `/account.html`, account creation, sign-out, profile separation and mobile behavior. Owner confirmed provider enabled with screenshot, and beta test button `GOOGLE_READY=true` deployed. Complete real user sign-in and account isolation test before announcing production readiness.

Official documentation: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

### Email/password with zero-cost personal Gmail SMTP (for early beta only)

1. Create a **dedicated free Gmail sender account** just for service emails. Do not reuse an existing personal mailbox. Enable two-step verification and create a Google **app password** if Google allows it.
2. In Supabase Dashboard → Authentication → SMTP Settings, configure:
   - Sender address: exactly the dedicated Gmail address (do **not** use `@github.io`).
   - Sender name: `AimRoutine Tracker`.
   - SMTP host: `smtp.gmail.com`.
   - SMTP port: `465` (SSL) or `587` (STARTTLS), depending on the interface.
   - SMTP user: the dedicated Gmail address.
   - SMTP password: its **Google app password**, not the ordinary password; enter it **only into the Supabase dashboard**.
3. Keep Supabase **Confirm email** enabled. Do **not** disable verification to avoid needing SMTP.
4. Test confirmation and password-reset email end-to-end on two different mail providers. Watch spam and authentication error logs; Gmail can throttle, reject or suspend automated sending. Rate limits and per-account thresholds can change.
5. Enable CAPTCHA/bot resistance, maintain controlled signup volumes and document retention/deletion. Only then change `SIGNUPS_READY=false` to `true` in `account-v7.mjs`.

Supabase has documented Gmail SMTP support but recommends production-grade providers for reliable deliverability. Treat this Gmail method as a **small-scale testing/beta workaround**, not a reliable bulk-email solution.

Google app-password instructions: https://support.google.com/accounts/answer/185833
Supabase SMTP: https://supabase.com/docs/guides/auth/auth-smtp
Supabase Gmail troubleshooting: https://supabase.com/kb/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y

**Current state (Nov 6):** The owner enabled Google provider in Supabase, confirmed its enabled status by screenshot, and confirmed Gmail SMTP invitation was delivered. Google OAuth test button is enabled on the web; end-to-end sign-in has not yet been confirmed. Public email/password signup remains closed until direct signup-confirmation/recovery testing and account isolation verification. Do not claim the cloud is fully production-ready. If dedicated Gmail SMTP cannot reliably deliver, keep email signups closed and offer Google login once tested.

## Password leakage prevention on Supabase Free (6 November 2026)

- Supabase's **native leaked-password protection is a paid Pro+ feature**, unavailable on our $0 Free project; the Security Advisor will continue to report `auth_leaked_password_protection` until Supabase changes its plan availability. Source: https://supabase.com/docs/guides/auth/password-security.
- Added `password-security-v7.mjs`: browser-side free Have I Been Pwned Pwned Passwords check using 5 SHA-1 hex characters, k-anonymity and padding, only when the user SUBMITS a new password. The full password and full hash never leave the browser for HIBP; the request can expose network metadata/IP. On API failure, refuse the password change rather than silently bypassing the check. Require at least 8 characters, including uppercase, lowercase, number and symbol, and reject trivial repetition. **The production Supabase server-side minimum of eight characters and four-category complexity were independently verified by direct API probes.**
- **Security limitation:** this is client-side only. Direct calls to Supabase Auth APIs can bypass it. It **does not replace native server-side password-leak protection** and MUST NOT be described as a fixed security advisor warning.
- Public email signup stays gated pending real two-account E2E, full password recovery, secure deletion and SMTP sending under load. Google OAuth does not use AimRoutine passwords.
- The project owner set Supabase Authentication → Providers → Email → minimum password length to **8** and required lowercase, uppercase, digit, and symbol. Three production negative/gated signup probes verified enforcement on 6 November 2026 (HTTP 422 for seven characters and eight lowercase-only; HTTP 403 at the beta signup hook for an eight-character compliant password).

## Google account self-deletion — simplified 6 November 2026

After successful user testing of Google reauthentication and account deletion, the owner explicitly requested a simpler experience. A **currently signed-in Google user** can now type exactly `SUPPRIMER` (uppercase and case-sensitive) and click the red permanent-delete button. There is **no second Google sign-in**, no AimRoutine password and no extra browser confirmation popup. Email/password-only accounts keep their existing password and confirmation requirements.

The deployed `delete-aim-account` Edge Function (version 2) maintains `verify_jwt=true` and requires an Auth-verified user JWT. It reads the user ID from `auth.getUser()` and checks it matches the verified JWT claims. It rejects any anonymous requests and any confirmation other than `SUPPRIMER`. It does not accept user IDs from clients. It allows Google-identity accounts to bypass only the recent-reauthentication timestamp condition; non-Google accounts must still be recently signed in.

**Security trade-off:** this is less protective on shared devices or if an authenticated session has been stolen. A signed-in Google session plus the deletion word can now permanently delete the account. Recommend users sign out on shared devices; consider optional step-up authentication if necessary. The original guest data on a device remains local and is not deleted remotely.

**Verification:** the account form and backend have been deployed, but a real self-deletion test for this simplified version has not been performed by the assistant. The earlier 2-step Google self-deletion was tested by the owner. Avoid automatic deletion tests on actual user accounts.

## Release verification checkpoint — 6 November 2026 (afternoon)

Completed via connected GitHub and Supabase management:
- Two existing Auth accounts are registered: one Google-identity account and one email/password account; both previously signed in. This is *not* a fresh recovery/email-delivery or Google-deletion test.
- Verified all four cloud tables have RLS enabled, authenticated-owner-only `USING` and `WITH CHECK` restrictions, and `ON DELETE CASCADE` foreign keys to `auth.users`. The anon role has no table grants.
- In a rolled-back SQL transaction with an `authenticated` role impersonating the *other* account, cross-user profile/preference SELECT, UPDATE, DELETE all affected **zero rows**. This is a database authorization test, not a two-browser E2E result.
- The deployed `delete-aim-account` function v2 accepts a validated user JWT and exactly `SUPPRIMER`, never a target user ID from the client. Google-identity accounts no longer need an OAuth step-up. The Google simplified flow remains untested with a new disposable account.
- Updated the FR/EN privacy page to accurately describe Google sign-in and deletion, browser/device copies, and the server-side password-check limitation.
- Expanded multi-browser smoke coverage to all public pages and improved service worker static-asset precaching. A repeatable Lighthouse report workflow was added. Check GitHub Actions conclusions, rather than assuming these runs passed.
- Public email/password sign-up remains gated only in the UI. The live Supabase Auth settings endpoint reports `disable_signup=false`: the backend still allows direct API signups. The official private contact is published. Google OAuth secret rotation, SMTP confirmation/reset E2E, bot/rate-limit configuration and real authenticated browser cloud tests are still pending. **Do not enable public registration yet.**

Safety reminder: Do not delete a real user's account as a test. Use an explicitly disposable account, confirm no valuable history, then test deletion with `SUPPRIMER` while signed in. Rotate any Google client secret previously pasted into chat; update Google Cloud and Supabase provider settings without committing or sharing the new secret.

## Latest evidence and operator action

See [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md) for verified SQL RLS tests across all four tables, live JWT rejection checks, simulated multi-device merge tests, the actual backend signup-policy result and the precise remaining owner-controlled actions. Lighthouse measurements after responsive imagery and image preloading show performance 84/100 (home), 89/100 (training) and 99/100 (account) in one automated run.
