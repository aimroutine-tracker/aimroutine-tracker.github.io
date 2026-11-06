#!/usr/bin/env python3
"""Build only browser-deliverable root files for GitHub Pages.

The source repository deliberately contains documentation, tests, workflows,
and backend migrations. None of those belong in the published Pages artifact.
"""
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / ".public-site"
# The current website is a flat static site. Add new asset suffixes deliberately.
PUBLIC_SUFFIXES = frozenset({
    ".html", ".css", ".js", ".mjs", ".png", ".svg", ".webp",
    ".jpg", ".jpeg", ".ico", ".xml", ".txt", ".webmanifest",
})
REQUIRED = frozenset({
    "index.html", "account.html", "training.html", "privacy.html",
    "terms.html", "riot-integration.html", "riot.txt", "robots.txt",
    "sitemap.xml", ".nojekyll",
})
DENIED = frozenset({
    "README.md", "CLOUD_V7_SETUP.md", "PUBLIC_RELEASE_CHECKLIST.md",
    ".github", "supabase", "tests", "scripts", ".git",
})

def main():
    if DEST.exists():
        if DEST.is_symlink():
            raise SystemExit("Unsafe symlink at publish destination")
        shutil.rmtree(DEST)
    DEST.mkdir()
    copied = []
    for source in ROOT.iterdir():
        if source.name == ".nojekyll" or source.suffix.lower() in PUBLIC_SUFFIXES:
            if source.is_symlink():
                raise SystemExit("Refusing linked public asset: " + source.name)
            if not source.is_file():
                continue
            shutil.copy2(source, DEST / source.name)
            copied.append(source.name)
    missing = REQUIRED.difference(copied)
    if missing:
        raise SystemExit("Missing essential public assets: " + ", ".join(sorted(missing)))
    unexpected = DENIED.intersection(p.name for p in DEST.iterdir())
    if unexpected:
        raise SystemExit("Private files in Pages artifact: " + ", ".join(sorted(unexpected)))
    if any(p.is_dir() or p.suffix.lower() not in PUBLIC_SUFFIXES and p.name != ".nojekyll"
           for p in DEST.iterdir()):
        raise SystemExit("Unexpected published file or directory")
    print("GitHub Pages: " + str(len(copied)) +
          " static public assets prepared; tests, docs and backend excluded.")

if __name__ == "__main__":
    main()
