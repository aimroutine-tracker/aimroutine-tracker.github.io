#!/usr/bin/env python3
"""Block accidental legacy/direct Supabase writes from reviewed public JS.

This is a source-code regression guard, NOT a replacement for PostgreSQL
permissions, RLS or real disposable-account tests. The browser remains an
untrusted execution environment. Keep the guarded Cloud write RPC exclusive
to cloud-sync-v7.mjs and never reintroduce direct REST mutations.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "scripts" / "public-assets.txt"
OWNER_MODULE = "cloud-sync-v7.mjs"
TABLES = ("aim_sessions", "aim_presets", "aim_profiles", "aim_preferences")
TABLE_PATTERN = "(?:" + "|".join(TABLES) + ")"

# Existing Cloud access is deliberately centralized. A newly introduced module
# needs a reviewed architectural change instead of silently bypassing this.
DIRECT_TABLE_ACCESS = re.compile(
    r"\.from\s*\(\s*['\"]" + TABLE_PATTERN + r"['\"]\s*\)",
    re.IGNORECASE,
)
LEGACY_RPC = re.compile(
    r"\.rpc\s*\(\s*['\"]aim_reset_my_progress['\"]",
    re.IGNORECASE,
)
GUARDED_RPC = re.compile(
    r"\.rpc\s*\(\s*['\"]aim_apply_progress_for_user['\"]",
    re.IGNORECASE,
)
MUTATION = re.compile(
    r"\.from\s*\(\s*['\"]" + TABLE_PATTERN +
    r"['\"]\s*\)\s*\.\s*(?:insert|upsert|update|delete)\s*\(",
    re.IGNORECASE,
)


def inspect_script(name: str, source: str) -> list[str]:
    errors = []
    if LEGACY_RPC.search(source):
        errors.append(f"{name}: legacy unbound deletion RPC is forbidden")
    if MUTATION.search(source):
        errors.append(f"{name}: direct REST mutation bypasses reset transaction lock")
    for match in DIRECT_TABLE_ACCESS.finditer(source):
        if name != OWNER_MODULE:
            errors.append(f"{name}: Cloud table access must remain in {OWNER_MODULE}")
            break
        # The sole Cloud module may READ aim tables directly, never stash a
        # table Query for later direct INSERT/UPSERT/UPDATE/DELETE. This also
        # rejects aliased mutations which would evade the immediate-chain regex.
        if not re.match(r"\s*\.\s*select\s*\(", source[match.end():]):
            errors.append(f"{name}: table access must select; all writes use atomic RPC")
            break
    if name != OWNER_MODULE and GUARDED_RPC.search(source):
        errors.append(f"{name}: guarded write RPC must remain in {OWNER_MODULE}")
    return errors


def main() -> int:
    entries = [
        line.strip() for line in ASSETS.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    js = [name for name in entries if name.endswith((".js", ".mjs"))]
    errors: list[str] = []
    if OWNER_MODULE not in js:
        errors.append("Cloud owner module is absent from public artifact allowlist")
    for name in js:
        path = ROOT / name
        if not path.is_file():
            errors.append(f"Missing reviewed JavaScript asset: {name}")
            continue
        errors.extend(inspect_script(name, path.read_text(encoding="utf-8")))
    owner = ROOT / OWNER_MODULE
    if owner.is_file() and not GUARDED_RPC.search(owner.read_text(encoding="utf-8")):
        errors.append("Centralized Cloud writer no longer calls atomic V3 RPC")
    if errors:
        for error in errors:
            print("ERROR: " + error)
        return 1
    print(f"PASS: {len(js)} public JS assets contain no legacy/unscoped Cloud write paths.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
