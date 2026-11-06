# AimRoutine Tracker Cloud V7 — Deployment checklist

**Status (November 6, 2026):** Supabase project `lmzswtzboobpokumxzhy` is ACTIVE_HEALTHY, hosted in Paris (`eu-west-3`), under organization AIM Routine Tracker. Free project cost quoted $0/month and approved. Migration `cloud_v7_initial` applied with four owner-only RLS tables; Supabase Security Advisor returned zero security warnings.

## Required before public signup

1. Open https://supabase.com/dashboard/project/lmzswtzboobpokumxzhy/auth/url-configuration
2. Set Site URL to `https://aimroutine-tracker.github.io/`.
3. Add allowed redirects `https://aimroutine-tracker.github.io/account.html` and `https://aimroutine-tracker.github.io/account.html?reset=1`.
4. Verify confirmation and recovery e-mails with real test users, and check Supabase Auth email limits.
5. Implement full authentication-account deletion and a private contact channel.
6. Complete authenticated end-to-end tests with two distinct accounts, including cross-account read/update/delete rejection and offline conflicts.
7. Only then enable `SIGNUPS_READY` in `account-v7.mjs`.

## Current implementation

- `cloud-client-v7.mjs` uses Supabase JS SDK v2.119.0 with only the **public publishable** key, no service-role keys.
- `account.html` provides sign-in, optional sync activation, manual sync, explicit guest-history import, cloud progress deletion (not account deletion), and password-reset/registration screens gated pending auth URL configuration.
- `training-entry-v7.mjs` loads guest/local mode when not authenticated and account-scoped storage when signed in, synchronizing before v5/v6 modules load. Changes queue cloud uploads if opted in.
- `cloud-sync-v7.mjs` stores sessions and favorites by ID, soft-deletes removed favorites, and handles profile/goal fields. Robust real-world conflict testing still needed; retain JSON exports.
- Original local keys: `aimroutine_web_training_v2` for sessions, favorites, weekly goal and `aimroutine_player_extensions_v1` for V6 player profile/program. Guest data is not automatically uploaded to a new account.
- Four RLS-protected tables (`aim_profiles`, `aim_preferences`, `aim_sessions`, `aim_presets`) own rows by `auth.uid()`. The `anon` role has no table privileges.
- Cloud is not Riot Sign On and not connected to the Windows 2.9.1 application.

Do not state cloud registration is generally available until all steps above are completed.

## Progress: deletion endpoint

- Edge Function `delete-aim-account` deployed with **verify_jwt true**, `@supabase/server@1.9.2` with `auth:'user'`, and no administrative credentials in public JS. It verifies the validated user identity, checks a fresh sign-in (five minutes), then calls `auth.admin.deleteUser(user.id)` using the server-provisioned admin client. Database foreign keys cascade to all four training tables.
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
- Added `password-security-v7.mjs`: browser-side free Have I Been Pwned Pwned Passwords check using 5 SHA-1 hex characters, k-anonymity and padding, only when the user SUBMITS a new password. The full password and full hash never leave the browser for HIBP; the request can expose network metadata/IP. On API failure, refuse the password change rather than silently bypassing the check. Refuse fewer than 12 characters and trivial repetition.
- **Security limitation:** this is client-side only. Direct calls to Supabase Auth APIs can bypass it. It **does not replace native server-side password-leak protection** and MUST NOT be described as a fixed security advisor warning.
- Public email signup stays gated pending real two-account E2E, full password recovery, secure deletion and SMTP sending under load. Google OAuth does not use AimRoutine passwords.
- The project owner should additionally set Supabase Authentication → Providers → Email → minimum password length to **12** and the strongest available character requirements, on the free plan. This protects direct API requests too; do not claim this backend setting has been changed unless verified.
