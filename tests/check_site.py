#!/usr/bin/env python3
"""Static, network-free site checks: internal links, assets and essential page structure."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import sys

ROOT = Path(__file__).resolve().parents[1]
SKIP_SCHEMES = {"https", "http", "mailto", "tel", "data", "javascript"}
IGNORE = {".git", "node_modules"}
PAGES = sorted(ROOT.glob("*.html"))

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.ids = set()
        self.duplicates = []
        self.main_count = 0
        self.nav = False
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == "main":
            self.main_count += 1
        if tag == "nav" and "site31-nav" in data.get("class", ""):
            self.nav = True
        if "id" in data:
            value = data["id"]
            if value in self.ids:
                self.duplicates.append(value)
            self.ids.add(value)
        attr = "href" if tag in ("a","link") else "src" if tag in ("script","img","source") else None
        if attr and data.get(attr):
            self.refs.append((tag, data[attr]))

issues = []
for page in PAGES:
    p = PageParser()
    try:
        p.feed(page.read_text(encoding="utf-8"))
    except Exception as error:
        issues.append(f"{page.name}: parsing error {error}")
        continue
    if p.main_count != 1:
        issues.append(f"{page.name}: expected one <main>, found {p.main_count}")
    if not p.nav:
        issues.append(f"{page.name}: shared primary navigation is absent")
    for ident in p.duplicates:
        issues.append(f"{page.name}: duplicated id {ident}")
    for tag, raw in p.refs:
        url = urlsplit(raw)
        if url.scheme in SKIP_SCHEMES or url.netloc or raw.startswith("//") or not url.path:
            continue
        target = unquote(url.path).lstrip("/")
        if not target or target.startswith(".well-known"):
            continue
        absolute = ROOT / target
        if not absolute.is_file():
            issues.append(f"{page.name}: missing {tag} target {raw}")
    if page.name in {"index.html", "product.html", "presentation.html", "riot-integration.html", "updates.html", "privacy.html", "terms.html", "404.html", "training.html", "releases.html", "account.html"}:
        html = page.read_text(encoding="utf-8")
        if 'src="aimroutine-brand-a-v2.svg?v=1"' not in html:
            issues.append(f"{page.name}: official logo missing from header")
        if 'href="favicon.svg?v=3" type="image/svg+xml"' not in html:
            issues.append(f"{page.name}: official browser favicon missing")
        if 'property="og:image" content="https://aimroutine-tracker.github.io/aimroutine-logo.png?v=3"' not in html:
            issues.append(f"{page.name}: official social image missing")
        if 'favicon.svg' in html and 'favicon.svg?v=3' not in html:
            issues.append(f"{page.name}: outdated favicon reference")
    # V9 design smoke checks: every public route uses the same updated stylesheet.
    if 'visual-v8.css?v=2' not in page.read_text(encoding='utf-8'):
        issues.append(f"{page.name}: shared V9 visual stylesheet link missing")
    if page.name == "index.html":
        html = page.read_text(encoding="utf-8")
        for link in ('id="choose-path"', 'class="ar9-path-grid ar17-path-grid"', 'href="training.html"', 'href="product.html"', 'href="account.html"'):
            if link not in html:
                issues.append("index.html: missing V9 navigation destination " + link)
    if page.name == "account.html":
        html = page.read_text(encoding="utf-8")
        for marker in ['id="login-form"', 'id="signup-form"', 'id="dashboard-panel"', 'account-v7.mjs', 'account-v7.css']:
            if marker not in html:
                issues.append(f"account.html: missing {marker}")
    if page.name == "changelog.html":
        source = ROOT / "PATCH-NOTES-AimRoutine-Tracker.md"
        if not source.exists():
            issues.append("changelog.html: original Markdown source missing")
        html = page.read_text(encoding="utf-8")
        if html.count('class="ar-note-chapter"') != 18:
            issues.append("changelog.html: expected 18 historical chapters")
        if "2.9.1" not in html or "Riot Sign On" not in html:
            issues.append("changelog.html: release status not visible")
    if page.name == "training.html":
        for marker in ['id="panel-dashboard"', 'id="panel-builder"', 'id="panel-insights"', 'id="panel-coach"', 'id="panel-data"', 'training-entry-v7.mjs', 'training-v5.css']:
            if marker not in page.read_text(encoding="utf-8"):
                issues.append(f"training.html: missing {marker}")

print(f"Checked {len(PAGES)} HTML pages and their local references.")
if issues:
    print("\n".join("ERROR: " + line for line in issues))
    sys.exit(1)
print("Site structure and local references: OK")
