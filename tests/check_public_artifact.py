#!/usr/bin/env python3
"""Fail closed if the Pages artifact contains unreviewed or sensitive files."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / ".public-site"
MANIFEST = ROOT / "scripts" / "public-assets.txt"
expected = {
    line.strip() for line in MANIFEST.read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.lstrip().startswith("#")
}
if not PUBLIC.is_dir() or PUBLIC.is_symlink():
    raise SystemExit("Public artifact is missing or unsafe")
actual = {p.name for p in PUBLIC.iterdir()}
if actual != expected:
    raise SystemExit("Public artifact differs from allowlist")
if any(not p.is_file() or p.is_symlink() for p in PUBLIC.iterdir()):
    raise SystemExit("Published artifact must contain regular root files only")
if (PUBLIC / "riot.txt").read_bytes() != (ROOT / "riot.txt").read_bytes():
    raise SystemExit("Riot verification was changed")
for path in PUBLIC.iterdir():
    if path.name.startswith(".") and path.name != ".nojekyll":
        raise SystemExit("Hidden file in public artifact")
subprocess.run([sys.executable, str(ROOT / "tests" / "check_secrets.py")],
               cwd=ROOT, check=True)
print("Public artifact allowlist and secret checks passed")
