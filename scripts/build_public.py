#!/usr/bin/env python3
"""Build an explicitly allowlisted GitHub Pages artifact.

Only files reviewed in scripts/public-assets.txt are copied.
Any newly added public-looking root file must be reviewed before publishing.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / ".public-site"
MANIFEST = ROOT / "scripts" / "public-assets.txt"
PUBLIC_SUFFIXES = frozenset({
    ".html", ".css", ".js", ".mjs", ".png", ".svg", ".webp",
    ".jpg", ".jpeg", ".ico", ".xml", ".txt", ".webmanifest",
})
REQUIRED = frozenset({
    "index.html", "account.html", "training.html", "privacy.html",
    "terms.html", "riot-integration.html", "riot.txt", "robots.txt",
    "sitemap.xml", ".nojekyll",
})

def read_manifest():
    entries = [
        line.strip() for line in MANIFEST.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if len(entries) != len(set(entries)):
        raise SystemExit("Duplicate file names in public asset allowlist")
    for name in entries:
        # No directory traversal, dotfiles (except .nojekyll), or arbitrary formats.
        if (Path(name).name != name or "/" in name or "\\" in name or
            name.startswith(".") and name != ".nojekyll" or
            name != ".nojekyll" and Path(name).suffix.lower() not in PUBLIC_SUFFIXES):
            raise SystemExit("Unexpected public allowlist entry: " + name)
    if not REQUIRED.issubset(entries):
        raise SystemExit("Missing required public pages and Riot verification")
    return entries

def main():
    entries = read_manifest()
    listed = set(entries)
    candidates = {
        path.name for path in ROOT.iterdir()
        if path.is_file() and
        (path.name == ".nojekyll" or path.suffix.lower() in PUBLIC_SUFFIXES)
    }
    extra = candidates - listed
    if extra:
        raise SystemExit("New public-looking files require review in public-assets.txt: " +
                         ", ".join(sorted(extra)))
    if DEST.is_symlink():
        raise SystemExit("Refusing symlink at deployment destination")
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    for name in entries:
        src = ROOT / name
        if src.is_symlink() or not src.is_file():
            raise SystemExit("Missing or unsafe public asset: " + name)
        shutil.copy2(src, DEST / name)
    if {p.name for p in DEST.iterdir()} != listed:
        raise SystemExit("Public artifact differs from reviewed manifest")
    print(f"Prepared {len(entries)} reviewed static assets, with Riot proof preserved.")

if __name__ == "__main__":
    main()
