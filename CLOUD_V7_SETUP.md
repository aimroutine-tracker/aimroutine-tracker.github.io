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
