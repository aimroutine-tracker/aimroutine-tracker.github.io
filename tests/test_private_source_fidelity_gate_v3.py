#!/usr/bin/env python3
"""Unit tests for the private four-reference release gate (no owner pixels used)."""
from pathlib import Path
import hashlib
import json
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

GATE = Path(__file__).with_name("check-source-fidelity-v3.py")
PAGES = ("home", "routines", "progress", "account")
BOUNDS = {
    "home": [780, 55, 1672, 355],
    "routines": [780, 55, 1672, 300],
    "progress": [780, 55, 1672, 260],
    "account": [780, 55, 1672, 300],
}


def tiny_sample_png():
    """Valid 1672x941 grayscale PNG from artificial zero pixels only."""
    def chunk(kind, body):
        data = kind + body
        return (struct.pack(">I", len(body)) + data +
                struct.pack(">I", zlib.crc32(data) & 0xffffffff))
    raw = (b"\x00" + bytes(1672)) * 941
    header = struct.pack(">IIBBBBB", 1672, 941, 8, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


class SourceFidelityGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.refs = self.root / "tests" / "visual-references"
        self.refs.mkdir(parents=True)
        shutil.copyfile(GATE, self.root / "tests" / GATE.name)
        self.evidence = self.root / "visual-results"
        self.evidence.mkdir()
        self.sample = tiny_sample_png()
        sha = hashlib.sha256(self.sample).hexdigest()
        manifest = {
            "quality_regression_tolerance_mae": 0.25,
            "references": {
                name: {
                    "filename": name + ".png",
                    "sha256": sha,
                    "verified_best_mae_0_to_255": 25.0,
                } for name in PAGES
            },
        }
        (self.refs / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        for name in PAGES:
            (self.refs / (name + ".png")).write_bytes(self.sample)
            for suffix in ("source-diff", "source-overlay"):
                (self.evidence / (name + "-" + suffix + ".png")).write_bytes(self.sample)
        self.write_report(25.0)

    def write_report(self, value, *, missing=False):
        report = []
        for name in PAGES:
            record = {
                "page": name,
                "comparison_to_owner_reference": "EXECUTED: synthetic unit test inputs",
                "reference_before_mae_0_to_255": 45.0,
                "reference_mae_0_to_255": value,
                "source_visual_regressed": False,
                "source_region_mae": {"header": 1, "hero": 2, "mid": 3, "lower": 4},
                "source_hero_art_bounds": BOUNDS[name],
                "source_hero_art_before_mae_0_to_255": 45.0,
                "source_hero_art_mae_0_to_255": value,
                "source_hero_art_regressed": False,
            }
            if missing and name == "account":
                record.pop("reference_mae_0_to_255")
            report.append(record)
        (self.evidence / "comparison-report.json").write_text(
            json.dumps(report), encoding="utf-8"
        )

    def gate(self):
        return subprocess.run(
            [sys.executable, str(self.root / "tests" / GATE.name)],
            cwd=self.root, text=True, capture_output=True, check=False,
        )

    def test_verified_best_passes(self):
        result = self.gate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("SOURCE EVIDENCE VERIFIED", result.stdout)

    def test_within_tolerance_passes(self):
        self.write_report(25.24)
        result = self.gate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_regression_over_tolerance_blocks(self):
        self.write_report(25.26)
        result = self.gate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("owner reference visual quality regressed", result.stdout)

    def test_missing_original_blocks(self):
        (self.refs / "routines.png").unlink()
        result = self.gate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("required original PNG missing", result.stdout)

    def test_original_hash_mismatch_blocks(self):
        (self.refs / "progress.png").write_bytes(self.sample + b"altered")
        result = self.gate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SHA-256 mismatch", result.stdout)

    def test_missing_candidate_mae_blocks(self):
        self.write_report(25.0, missing=True)
        result = self.gate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("quantitative source pixel error missing", result.stdout)


if __name__ == "__main__":
    unittest.main()
