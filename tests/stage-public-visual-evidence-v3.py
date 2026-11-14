#!/usr/bin/env python3
"""Stage ONLY public-safe V3 before/after screenshots for GitHub Actions.

Original-reference images, source overlays and source diffs are intentionally
never copied: public repository artifacts are accessible beyond the project.
The private source-fidelity gate regenerates those files inside its own runner.
"""
from pathlib import Path
import json
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "visual-results"
DEST = ROOT / "public-visual-evidence"
PAGES = ("home", "routines", "progress", "account")
VIEWPORT = (1672, 941)
RESPONSIVE = (390, 768, 1024)

# Explicit names instead of a wildcard: *-before.png would also match
# *-source-before.png and could expose reference-derived pixels.
EXPECTED = {}
for page in PAGES:
    for kind in ("before", "after", "change-diff", "before-after-overlay"):
        EXPECTED[f"{page}-{kind}.png"] = VIEWPORT
    for width in RESPONSIVE:
        EXPECTED[f"{page}-{width}.png"] = (width, 850)
    for width in (1672, 390):
        EXPECTED[f"{page}-en-{width}.png"] = (width, 941 if width == 1672 else 850)


def main():
    if not SRC.is_dir() or SRC.is_symlink():
        raise SystemExit("Missing or unsafe V3 screenshot directory")
    if DEST.is_symlink():
        raise SystemExit("Refusing symlink at public evidence destination")
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    for filename, dimensions in EXPECTED.items():
        source = SRC / filename
        if not source.is_file() or source.is_symlink():
            raise SystemExit(f"Missing or unsafe public-safe screenshot: {filename}")
        with source.open("rb") as handle:
            header = handle.read(24)
        if (len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n"
                or struct.unpack(">II", header[16:24]) != dimensions):
            raise SystemExit(f"Unexpected screenshot format/viewport: {filename}")
        shutil.copyfile(source, DEST / filename)

    # JSON describes numeric comparisons, never contains source-image pixels.
    report = SRC / "comparison-report.json"
    if not report.is_file() or report.is_symlink():
        raise SystemExit("Missing safe comparison report")
    parsed = json.loads(report.read_text(encoding="utf-8"))
    if (not isinstance(parsed, list) or len(parsed) != len(PAGES)
            or {row.get("page") for row in parsed if isinstance(row, dict)} != set(PAGES)):
        raise SystemExit("Incomplete V3 page comparison report")
    # Minimize metadata: do not upload error traces, paths, or arbitrary keys.
    public_report = [
        {"page": row["page"],
         "source_compared": row.get("comparison_to_owner_reference", "").startswith("EXECUTED:"),
         "baseline_mae": row.get("reference_before_mae_0_to_255"),
         "candidate_mae": row.get("reference_mae_0_to_255")}
        for row in parsed
    ]
    (DEST / "public-comparison-summary.json").write_text(
        json.dumps(public_report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    assert {item.name for item in DEST.iterdir()} == set(EXPECTED) | {"public-comparison-summary.json"}
    print(f"Staged {len(EXPECTED)} non-reference screenshots and redacted summary.")
    print("Private original PNGs, source overlays and source diffs excluded.")


if __name__ == "__main__":
    main()
