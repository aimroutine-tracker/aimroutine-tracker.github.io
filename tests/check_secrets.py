#!/usr/bin/env python3
"""Check tracked source for common credential patterns without printing secrets.

Deliberately conservative: this does NOT replace host-side secret scanning,
history scans, credential rotation, or manual review.
"""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "Riot Games API key": r"RGAPI-[A-Za-z0-9_-]{10,}",
    "Google OAuth client secret": r"GOCSPX-[A-Za-z0-9_-]{10,}",
    "Supabase privileged key": r"sb_secret_[A-Za-z0-9_-]{12,}",
    "Google private API key": r"AIza[A-Za-z0-9_-]{30,}",
    "GitHub token": r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,}",
    "GitLab token": r"glpat-[A-Za-z0-9_-]{15,}",
    "AWS access key": r"(?:AKIA|ASIA)[A-Z0-9]{16}",
    "OpenAI API key": r"sk-(?:proj-)?[A-Za-z0-9_-]{35,}",
    "Stripe secret key": r"sk_live_[A-Za-z0-9]{16,}",
    "Private key PEM": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "OAuth JSON client secret": r'"client_secret"\s*:\s*"[A-Za-z0-9_-]{12,}"',
}
TEXT_EXTENSIONS = {
    ".html", ".js", ".mjs", ".ts", ".json", ".yml", ".yaml",
    ".md", ".txt", ".sql", ".toml", ".py", ".xml", ".css",
    ".webmanifest", ".sh",
}
SENSITIVE_EXTENSIONS = {".pem", ".p12", ".pfx", ".p8", ".key", ".jks", ".keystore"}
SENSITIVE_NAMES = {"id_rsa", "id_ed25519", "credentials.json", "service-account.json"}
try:
    names = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).split(b"\0")
except (OSError, subprocess.CalledProcessError):
    raise SystemExit("Unable to inspect tracked files") from None

issues = []
scanned = 0
for raw in names:
    if not raw:
        continue
    relative = Path(raw.decode("utf-8", "replace"))
    path = ROOT / relative
    name = relative.name.lower()
    if (name == ".env" or name.startswith(".env.") or name in SENSITIVE_NAMES or
            relative.suffix.lower() in SENSITIVE_EXTENSIONS):
        issues.append((str(relative), "sensitive filename"))
    if name == "check_secrets.py" or path.suffix.lower() not in TEXT_EXTENSIONS:
        continue
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        continue
    scanned += 1
    for label, pattern in PATTERNS.items():
        if re.search(pattern, content):
            issues.append((str(relative), label))
if issues:
    for filename, label in issues:
        print(f"SECURITY ERROR: {label} in {filename} (value not shown)")
    sys.exit(1)
print(f"Secret patterns: none found in {scanned} tracked source files.")
