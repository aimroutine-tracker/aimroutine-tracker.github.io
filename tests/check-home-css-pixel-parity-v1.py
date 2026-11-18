#!/usr/bin/env python3
"""Check PNG pixel-equivalence of five lossless home CSS bundles.

The 26 original CSS sources are read by the same browser on the same DOM.
Computed styles and geometry must be byte-identical (Node test); this check
accepts only insignificant screenshot rasterization/antialias fluctuations.
This is NOT fidelity validation against the four owner reference PNGs.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path("visual-results/css-parity")
MAX_CHANGED_FRACTION = 0.0001   # <= 0.01% of viewport pixels
MAX_CHANNEL_DELTA = 2           # <= 2 RGB levels out of 255
MAX_MEAN_ABS_CHANNEL_DELTA = 0.0002
failed = []

for width, height in ((1672, 941), (390, 844)):
    left = ROOT / f"home-{width}-bundled.png"
    right = ROOT / f"home-{width}-original.png"
    if not left.is_file() or not right.is_file():
        raise SystemExit(f"Missing two comparison screenshots at {width}x{height}")
    with Image.open(left) as img1, Image.open(right) as img2:
        if img1.size != (width, height) or img2.size != (width, height):
            raise SystemExit(f"Unexpected CSS comparison dimensions for {width}x{height}")
        diff = ImageChops.difference(img1.convert("RGB"), img2.convert("RGB"))
        channels = diff.split()
        maximum = ImageChops.lighter(
            ImageChops.lighter(channels[0], channels[1]), channels[2]
        )
        changed = width * height - maximum.histogram()[0]
        fraction = changed / (width * height)
        max_delta = maximum.getextrema()[1]
        mean_delta = sum(ImageStat.Stat(diff).mean) / 3.0
        bbox = maximum.getbbox()
        print(
            f"HOME CSS {width}x{height}: {changed}/{width*height} changed pixels "
            f"({100*fraction:.5f}%), max RGB delta={max_delta}, "
            f"mean absolute channel delta={mean_delta:.8f}, bbox={bbox}"
        )
        if (fraction > MAX_CHANGED_FRACTION or max_delta > MAX_CHANNEL_DELTA
                or mean_delta > MAX_MEAN_ABS_CHANNEL_DELTA):
            failed.append(f"{width}x{height}")

if failed:
    raise SystemExit("CSS bundle causes more than rasterization noise on: " +
                     ", ".join(failed))
print("PASS: desktop/mobile CSS bundles preserve pixels within strict antialias noise thresholds.")
