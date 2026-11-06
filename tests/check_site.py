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
    if page.name == "training.html":
        for marker in ['id="panel-dashboard"', 'id="panel-builder"', 'id="panel-insights"', 'id="panel-coach"', 'id="panel-data"', 'training-v5.js', 'training-v5.css']:
            if marker not in page.read_text(encoding="utf-8"):
                issues.append(f"training.html: missing {marker}")

print(f"Checked {len(PAGES)} HTML pages and their local references.")
if issues:
    print("\n".join("ERROR: " + line for line in issues))
    sys.exit(1)
print("Site structure and local references: OK")
