#!/usr/bin/env python3
"""Fail CLOSED on V3 publication until account-bound cloud reset is implemented.

This checks local source/migration structure only. It does NOT prove a migration
was applied to Supabase or replace disposable A/B account tests. The separate
manual workflow attestation must cover the real server state.
"""
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
MIGRATIONS=ROOT/"supabase"/"migrations"
CLIENT=ROOT/"cloud-sync-v7.mjs"
NAME="aim_reset_my_progress_for_user"

def check_client(text: str) -> list[str]:
    problems=[]
    secure=r"\.rpc\(\s*['\"]aim_reset_my_progress_for_user['\"]\s*,\s*\{\s*expected_uid\s*:\s*uid\b"
    legacy=r"\.rpc\(\s*['\"]aim_reset_my_progress['\"]"
    if not re.search(secure,text):
        problems.append("Client must call account-bound RPC with {expected_uid:uid}; no fallback")
    if re.search(legacy,text):
        problems.append("Client still calls legacy unbound deletion RPC")
    return problems

def check_migration(text: str) -> list[str]:
    problems=[]
    checks={
        "a distinct account-bound RPC signature":r"create\s+or\s+replace\s+function\s+public\.aim_reset_my_progress_for_user\s*\(\s*expected_uid\s+uuid\s*\)",
        "invoker security":r"security\s+invoker",
        "JWT caller ownership":r"auth\.uid\s*\(\s*\)",
        "strict expected owner check":r"actor_id\s+is\s+distinct\s+from\s+expected_uid",
        "revoke anonymous and public execution":r"revoke\s+all\s+on\s+function\s+public\.aim_reset_my_progress_for_user\s*\(\s*uuid\s*\)\s+from\s+public\s*,\s*anon",
        "authenticated-only EXECUTE":r"grant\s+execute\s+on\s+function\s+public\.aim_reset_my_progress_for_user\s*\(\s*uuid\s*\)\s+to\s+authenticated",
    }
    for label,pattern in checks.items():
        if not re.search(pattern,text,re.IGNORECASE|re.DOTALL):
            problems.append("Migration must contain "+label)
    guard=re.search(r"actor_id\s+is\s+distinct\s+from\s+expected_uid",text,re.IGNORECASE)
    deletion=re.search(r"delete\s+from\s+public\.aim_sessions",text,re.IGNORECASE)
    if not deletion:
        problems.append("Migration does not delete the training sessions")
    elif not guard or guard.start()>deletion.start():
        problems.append("Account identity guard must occur before any deletion")
    if re.search(r"security\s+definer",text,re.IGNORECASE):
        problems.append("Account reset must never be SECURITY DEFINER")
    for table in ("aim_sessions","aim_presets","aim_profiles"):
        pattern=r"delete\s+from\s+public\."+table+r"\s+where\s+user_id\s*=\s*expected_uid"
        if not re.search(pattern,text,re.IGNORECASE):
            problems.append("Reset must restrict "+table+" to expected_uid")
    return problems

def main() -> int:
    errors=check_client(CLIENT.read_text(encoding="utf-8"))
    migrations=[]
    for path in MIGRATIONS.glob("*.sql"):
        body=path.read_text(encoding="utf-8")
        if re.search(r"create\s+or\s+replace\s+function\s+public\.aim_reset_my_progress_for_user\s*\(",body,re.IGNORECASE):
            migrations.append((path,body))
    if len(migrations)!=1:
        errors.append("Exactly one generated migration must define account-bound reset RPC (found "+str(len(migrations))+")")
    else:
        errors+=check_migration(migrations[0][1])
    if errors:
        print("V3 RELEASE BLOCKED — account-bound reset not ready:")
        for item in errors: print("- "+item)
        print("The SQL proposal in docs/ is intentionally NOT a deployed migration.")
        return 1
    print("Source/migration contract checks passed; manual live A/B verification is still required.")
    return 0

if __name__=="__main__":
    sys.exit(main())
