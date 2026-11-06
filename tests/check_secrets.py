#!/usr/bin/env python3
"""Fail CI if a tracked, text-based website file accidentally contains secret credentials.
This is a lightweight safeguard; it cannot replace rotating disclosed credentials or a
dedicated dependency/secret-scanning service. Never print matched values."""
from pathlib import Path
import re, subprocess, sys
ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
  "Google OAuth client secret": r"GOCSPX-[A-Za-z0-9_-]{10,}",
  "Riot Games API key": r"RGAPI-[A-Za-z0-9_-]{10,}",
  "Supabase secret key": r"sb_secret_[A-Za-z0-9_-]{12,}",
  "Google private API key": r"AIza[A-Za-z0-9_-]{30,}",
  "GitHub personal access token": r"ghp_[A-Za-z0-9]{32,}",
  "Private key PEM": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
  "OAuth JSON client_secret": r'"client_secret"\s*:\s*"[A-Za-z0-9_-]{12,}"',
}
TEXT_EXTENSIONS={".html",".js",".mjs",".ts",".json",".yml",".yaml",".md",".txt",".sql",".toml",".py"}
try:
  paths=subprocess.check_output(["git","ls-files","-z"],cwd=ROOT).split(b"\0")
except (OSError, subprocess.CalledProcessError):
  print("Unable to list tracked files for credential scanning.")
  sys.exit(2)
issues=[]
scanned=0
for raw in paths:
  if not raw:continue
  path=ROOT / raw.decode("utf-8","replace")
  if path.name=="check_secrets.py" or path.suffix not in TEXT_EXTENSIONS or not path.is_file():continue
  try:
    contents=path.read_text(encoding="utf-8")
  except (UnicodeError,OSError):continue
  scanned+=1
  for label,pattern in PATTERNS.items():
    if re.search(pattern,contents):issues.append((str(path.relative_to(ROOT)),label))
if issues:
  for filename,label in issues:print(f"SECURITY ERROR: possible {label} in {filename} (secret omitted)")
  sys.exit(1)
print(f"Secret patterns: none found in {scanned} tracked text files.")
