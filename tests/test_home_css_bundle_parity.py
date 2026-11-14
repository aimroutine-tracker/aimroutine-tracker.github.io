"""Lossless homepage CSS concatenation: original cascade, verified bytes.

Fails the quality workflow if a source stylesheet changes without the bundle
being regenerated, if sheet order drifts, or if someone adds @import/@charset.
No images, CSS rules, or design tokens are synthesized in this check.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
GROUPS = (
    ("styles.css", "design.css", "v5.css", "insights.css",
     "insights-guide.css", "insights-v2.css"),
    ("experience-v11.css", "aimroutine-v16.css",
     "site-presentation-v30.css", "site-global-v31.css",
     "site-polish-v33.css"),
    ("site-shared-v5.css", "visual-v8.css", "site-motion-v10.css",
     "site-arcade-v11.css", "site-arcade-v12.css"),
    ("site-future-v13.css", "site-v14-gallery.css",
     "site-v15-fidelity.css", "aimroutine-official-tokens-v2.css",
     "site-official-v16.css"),
    ("site-rebuild-v17.css", "site-interface-v18.css",
     "site-interface-v19.css", "site-reference-v20.css",
     "site-owner-reference-v3.css"),
)


def bundle_name(number):
    return f"site-home-bundle-v1-{number}.css"


def render_bundle(index, sources):
    banner = f"/* Auto-concatenated home CSS — V3, group {index}/5. Do not edit by hand. */\n"
    return banner + "".join(
        f"/* BEGIN {source} */\n"
        + (ROOT / source).read_text(encoding="utf-8")
        + f"\n/* END {source} */\n"
        for source in sources
    )


class HomeBundleParity(unittest.TestCase):
    def test_home_has_five_bundles_not_legacy_link_requests(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        links = re.findall(r'<link rel="stylesheet" href="([^"]+)">', html)
        self.assertEqual(links, [
            f"{bundle_name(i)}?v=1" for i in range(1, 6)
        ], "Original CSS cascade must remain in five ordered homepage sheets")

    def test_every_bundle_is_exact_source_concatenation(self):
        for index, sources in enumerate(GROUPS, 1):
            with self.subTest(bundle=bundle_name(index)):
                actual = (ROOT / bundle_name(index)).read_text(encoding="utf-8")
                self.assertEqual(actual, render_bundle(index, sources),
                    "A CSS source changed or bundle cascade was modified")

    def test_css_sources_cannot_include_import_or_charset(self):
        originals = [name for group in GROUPS for name in group]
        self.assertEqual(len(originals), 26)
        self.assertEqual(len(originals), len(set(originals)))
        for source in originals:
            with self.subTest(source=source):
                self.assertEqual((ROOT / source).parent, ROOT)
                text = (ROOT / source).read_text(encoding="utf-8")
                self.assertIsNone(re.search(r"@(?:import|charset)\b", text,
                                            flags=re.IGNORECASE))


if __name__ == "__main__":
    unittest.main()
