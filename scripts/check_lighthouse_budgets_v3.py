#!/usr/bin/env python3
"""Fail CI on severe Lighthouse regressions in the four V3 static pages.

These are deliberately *regression floors*, not claims of good Core Web Vitals,
field performance, or approval of reference screenshots. Lighthouse CI emulates
a mobile device on a local static server and is subject to run-to-run noise.

No external access, private credentials or user data.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import sys

PAGES = ("index", "training", "progress", "account")

# Baselines measured on local CI run 43204014530 (2026-11-12):
# index 63, training 71, progress 77, account 71.
# Leave a margin for runner variance, while catching large regressions.
PERFORMANCE_FLOORS = {
    "index": 48,
    "training": 55,
    "progress": 60,
    "account": 55,
}
CATEGORY_FLOORS = {
    "accessibility": 90,
    "best-practices": 90,
    "seo": 90,
}
# Milliseconds except CLS. These upper limits deliberately allow some
# measurement variance relative to the Nov 12 baseline.
METRIC_CEILINGS = {
    "largest-contentful-paint": 9000.0,
    "total-blocking-time": 800.0,
    "cumulative-layout-shift": 0.12,
}


def finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    n = float(value)
    return n if math.isfinite(n) else None


def evaluate(page: str, report: dict) -> list[str]:
    """Return concrete failures; missing data must never pass silently."""
    errors = []
    if page not in PAGES:
        return [f"Unexpected page: {page}"]
    categories = report.get("categories")
    if not isinstance(categories, dict):
        return [f"{page}: Lighthouse categories missing"]
    floors = {"performance": PERFORMANCE_FLOORS[page], **CATEGORY_FLOORS}
    for category, minimum in floors.items():
        entry = categories.get(category)
        raw = entry.get("score") if isinstance(entry, dict) else None
        score = finite_number(raw)
        if score is None or not 0 <= score <= 1:
            errors.append(f"{page}: {category} score missing/invalid")
        elif round(score * 100) < minimum:
            errors.append(f"{page}: {category} {round(score * 100)}/100 < {minimum}/100")
    audits = report.get("audits")
    if not isinstance(audits, dict):
        return errors + [f"{page}: Lighthouse audits missing"]
    for metric, maximum in METRIC_CEILINGS.items():
        audit = audits.get(metric)
        raw = audit.get("numericValue") if isinstance(audit, dict) else None
        value = finite_number(raw)
        if value is None or value < 0:
            errors.append(f"{page}: {metric} missing/invalid")
        elif value > maximum:
            errors.append(f"{page}: {metric} {value:g} > {maximum:g}")
    return errors


def check_directory(directory: Path) -> list[str]:
    files = sorted(directory.glob("*.report.json"))
    actual = [path.name.removesuffix(".report.json") for path in files]
    if sorted(actual) != sorted(PAGES):
        return [f"Expected exactly {', '.join(PAGES)} Lighthouse JSON reports; found {actual!r}"]
    failures = []
    for path in files:
        page = path.name.removesuffix(".report.json")
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(report, dict):
                raise ValueError("JSON root is not an object")
            failures.extend(evaluate(page, report))
        except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
            failures.append(f"{page}: unreadable Lighthouse report: {exc}")
    return failures


def main() -> int:
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("lh-reports")
    errors = check_directory(directory)
    if errors:
        print("LIGHTHOUSE V3 REGRESSION BUDGET FAILED:")
        for error in errors:
            print(" - " + error)
        return 1
    print("PASS: four Lighthouse reports satisfy V3 regression floors.")
    print("These CI floors do not certify production field performance or visual fidelity.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
