#!/usr/bin/env python3
"""Regression tests: public visual artifacts must never contain source pixels."""
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

SCRIPT = Path(__file__).with_name("stage-public-visual-evidence-v3.py")
PAGES = ("home", "routines", "progress", "account")


def chunk(kind, payload):
    data = kind + payload
    return struct.pack(">I", len(payload)) + data + struct.pack(">I", zlib.crc32(data) & 0xFFFFFFFF)


def png(width, height):
    # Valid lossless grayscale PNG, tiny compressed sample.
    pixels = (b"\x00" + b"\x00" * width) * height
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(pixels, 9))
            + chunk(b"IEND", b""))


class PublicVisualEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "tests").mkdir()
        shutil.copyfile(SCRIPT, self.root / "tests" / SCRIPT.name)
        self.visual = self.root / "visual-results"
        self.visual.mkdir()
        self.script = self.root / "tests" / SCRIPT.name
        report = []
        for page in PAGES:
            for suffix in ("before", "after", "change-diff", "before-after-overlay"):
                (self.visual / f"{page}-{suffix}.png").write_bytes(png(1672, 941))
            for width in (390, 768, 1024):
                (self.visual / f"{page}-{width}.png").write_bytes(png(width, 850))
            for width in (1672, 390):
                (self.visual / f"{page}-en-{width}.png").write_bytes(
                    png(width, 941 if width == 1672 else 850)
                )
            report.append({
                "page": page, "comparison_to_owner_reference": "EXECUTED: real input",
                "reference_before_mae_0_to_255": 40.0, "reference_mae_0_to_255": 30.0,
                "private_debug": "PRIVATE_SOURCE_PIXELS_MUST_NOT_LEAK"
            })
        (self.visual / "comparison-report.json").write_text(json.dumps(report), encoding="utf-8")

    def run_stage(self):
        return subprocess.run([sys.executable, str(self.script)], cwd=self.root,
                              text=True, capture_output=True, check=False)

    def test_only_explicit_public_screenshots_and_redacted_summary(self):
        (self.visual / "home-source-diff.png").write_bytes(b"PRIVATE_SOURCE_PIXELS_MUST_NOT_LEAK")
        (self.visual / "home-source-overlay.png").write_bytes(b"PRIVATE_SOURCE_PIXELS_MUST_NOT_LEAK")
        result = self.run_stage()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        staged = self.root / "public-visual-evidence"
        names = {p.name for p in staged.iterdir()}
        self.assertEqual(len(names), 37)
        self.assertFalse(any("-source-" in name for name in names))
        self.assertNotIn("PRIVATE_SOURCE_PIXELS_MUST_NOT_LEAK",
                         (staged / "public-comparison-summary.json").read_text(encoding="utf-8"))
        self.assertFalse((staged / "home-source-overlay.png").exists())

    def test_missing_evidence_fails_closed(self):
        (self.visual / "account-after.png").unlink()
        result = self.run_stage()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing or unsafe public-safe screenshot", result.stderr + result.stdout)

    def test_wrong_image_dimensions_fail_closed(self):
        (self.visual / "home-before.png").write_bytes(png(390, 850))
        result = self.run_stage()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unexpected screenshot format/viewport", result.stderr + result.stdout)


if __name__ == "__main__":
    unittest.main()
