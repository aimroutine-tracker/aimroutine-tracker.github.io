# AimRoutine Tracker — Cloud V7 architecture (preparation)

**State:** database migration and integration design only. No live Supabase project, account system, or online sync was created when this file was written. Do not label cloud functionality as available on the public website until deployed and tested.

## What stays local / what syncs

- The current website uses `aimroutine_web_training_v2` (sessions, presets, weeklyGoal) and `aimroutine_web_training_extensions_v1` (v6 profile, program and preferences). Discover key values from the live modules before implementing.
- Keep local storage for the guest/offline experience. Guest can train without an account.
- After explicit login and explicit one-time import consent, upload sessions and presets **per record**, profile and preferences **per user**. Do not delete local copies until a confirmed read-back matches the local data.
- Never merge two guests' datasets silently. If a player changes the signed-in account, show account separation, confirm the intended import and prevent cross-account contamination.
- Run input validation through existing v5/v6 validation functions both before upload and after download.
- Use record IDs and revision handling to reconcile multiple devices. Deleted records use `deleted_at` tombstones so offline devices cannot resurrect them. Sync must not use blind "replace all" writes.
- Existing training history and exported JSON must keep working when offline.
- Derived metrics and achievement badges should be recalculated from sessions, never trusted as authentication or game rankings.

## Auth and security

- Use Supabase Auth with email verification and password reset, plus a **publishable** browser key only.
- NEVER place a service role / secret key in GitHub Pages, JavaScript, HTML, a manifest, or a public commit.
- User data lives in `aim_profiles`, `aim_preferences`, `aim_sessions`, `aim_presets` with `user_id` foreign key and RLS policies restricting access to the authenticated owner.
- Confirm RLS by testing account A cannot list/update/delete account B's data. Check both the authenticated and unauthenticated API paths.
- No user-adjustable metadata can confer permissions, and no client-side trust alone is sufficient.
- Confirm site redirect URLs, email delivery, password reset and anti-abuse protection on the actual Supabase project.
- Configure an EU hosting region at project creation if that is the owner's choice. Update privacy policy for hosted account data, processors, retention and deletion.
- Cloud profile/account deletion must be implemented securely on the server, including relevant identity data; removing browser storage is not enough.

## Deployment checklist

1. Select the user's Supabase organization, then review **the actual quoted project cost** before project creation. Create project in chosen region.
2. Review migration `supabase/migrations/20261106053000_cloud_v7_initial.sql` and apply it to that project.
3. Verify table/column access privileges, ownership RLS and Supabase security advisors.
4. Get project API URL and **publishable** key; do not retrieve or deploy secret keys.
5. Implement login/signup/logout/password reset, safe URL redirects and accessible errors.
6. Implement per-record sync and conflict handling; test local-to-cloud migration, offline changes, account changes and record deletion.
7. Add browser E2E tests with two isolated users, including anonymous denial.
8. Update privacy/legal pages, publish once tests are green, and clearly mark cloud as optional.

## Roadmap

The Windows 2.9.1 desktop application is a different codebase. Cloud sync in the website does **not** automatically sync the Windows app. Windows must later implement the same validated data exchange and authentication flow, without storing privileged credentials in its client binary.

Riot Sign On / automatic match history retrieval remain separate, subject to their own permissions.
