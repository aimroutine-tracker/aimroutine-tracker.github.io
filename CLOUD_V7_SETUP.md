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
