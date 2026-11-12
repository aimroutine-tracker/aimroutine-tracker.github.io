#!/usr/bin/env python3
"""No browser/network needed: synthetic Lighthouse report contract tests."""
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts" / "check_lighthouse_budgets_v3.py"
SPEC = importlib.util.spec_from_file_location("aim_lighthouse_budgets", PATH)
BUDGET = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUDGET)


def sample(performance: float = 0.85) -> dict:
    return {
        "categories": {
            key: {"score": score} for key, score in {
                "performance": performance,
                "accessibility": 1.0,
                "best-practices": 1.0,
                "seo": 1.0,
            }.items()
        },
        "audits": {
            "largest-contentful-paint": {"numericValue": 6200.0},
            "total-blocking-time": {"numericValue": 180.0},
            "cumulative-layout-shift": {"numericValue": 0.012},
        },
    }


class LighthouseBudgetsTests(unittest.TestCase):
    def test_healthy_reports_pass_for_four_pages(self):
        for page in BUDGET.PAGES:
            with self.subTest(page=page):
                self.assertEqual(BUDGET.evaluate(page, sample()), [])

    def test_severe_performance_regression_fails(self):
        errors = BUDGET.evaluate("index", sample(0.20))
        self.assertTrue(any("performance" in item for item in errors))

    def test_missing_category_fails_closed(self):
        report = sample()
        del report["categories"]["accessibility"]
        self.assertTrue(any("accessibility score missing" in error
                            for error in BUDGET.evaluate("training", report)))

    def test_invalid_performance_score_fails_closed(self):
        report = sample()
        report["categories"]["performance"]["score"] = float("nan")
        self.assertTrue(BUDGET.evaluate("progress", report))
        report["categories"]["performance"]["score"] = True
        self.assertTrue(BUDGET.evaluate("progress", report))

    def test_excessive_lcp_tbt_or_layout_shift_fails(self):
        cases = {
            "largest-contentful-paint": 12000.0,
            "total-blocking-time": 1200.0,
            "cumulative-layout-shift": 0.3,
        }
        for metric, value in cases.items():
            with self.subTest(metric=metric):
                report = sample()
                report["audits"][metric]["numericValue"] = value
                self.assertTrue(any(metric in item for item in
                                    BUDGET.evaluate("account", report)))

    def test_missing_audit_is_not_a_pass(self):
        report = sample()
        del report["audits"]["largest-contentful-paint"]
        self.assertTrue(any("missing/invalid" in err
                            for err in BUDGET.evaluate("index", report)))

    def test_all_four_reports_are_mandatory(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            for page in BUDGET.PAGES:
                (directory / f"{page}.report.json").write_text(json.dumps(sample()))
            self.assertEqual(BUDGET.check_directory(directory), [])
            (directory / "account.report.json").unlink()
            self.assertTrue(BUDGET.check_directory(directory))

    def test_invalid_json_is_not_silently_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            for page in BUDGET.PAGES:
                (directory / f"{page}.report.json").write_text(json.dumps(sample()))
            (directory / "index.report.json").write_text("{not JSON", encoding="utf-8")
            self.assertTrue(any("unreadable" in err
                                for err in BUDGET.check_directory(directory)))


if __name__ == "__main__":
    unittest.main()
