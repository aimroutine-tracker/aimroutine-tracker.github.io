#!/usr/bin/env python3
"""Verify GitHub Pages publishes only intended static assets."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / ".public-site"
required = {
    "index.html", "account.html", "training.html", "privacy.html",
    "terms.html", "riot-integration.html", "riot.txt", "robots.txt",
    "sitemap.xml", ".nojekyll",
}
assert PUBLIC.is_dir(), "Site artifact missing"
assert required.issubset({p.name for p in PUBLIC.iterdir()}), "Essential page missing"
assert all(p.is_file() for p in PUBLIC.iterdir()), "Unexpected directory published"
assert not any(p.suffix in {".md", ".sql", ".py", ".toml", ".yml", ".yaml", ".map"}
               for p in PUBLIC.iterdir()), "Source, config or sourcemap exposed"
assert (PUBLIC / "riot.txt").read_bytes() == (ROOT / "riot.txt").read_bytes(), "Riot verification changed"
subprocess.run([sys.executable, str(ROOT / "tests" / "check_secrets.py")], cwd=ROOT, check=True)
print("Public artifact: verification and source/secret checks passed")
