"""Prepare contact sheets and readable landing-page crops after the browser suite.

These images supplement manual review of the source captures. They do not
constitute a pixel snapshot, accessibility audit, or export-parity check.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

root = Path("test-results/public-shell")
output = root / "review"
output.mkdir(parents=True, exist_ok=True)
count = 0
for width in (360, 768, 1440):
    paths = sorted((root / str(width)).glob("*.png"))
    assert paths, f"Run the public-shell browser tests first ({width}px missing)."
    count += len(paths)
    for offset in range(0, len(paths), 6):
        batch = paths[offset:offset + 6]
        canvas = Image.new("RGB", (1200, math.ceil(len(batch) / 3) * 650), "#f2f5f8")
        draw = ImageDraw.Draw(canvas)
        for index, path in enumerate(batch):
            x, y = (index % 3) * 400, (index // 3) * 650
            draw.text((x + 12, y + 8), f"{width}px / {path.stem}", fill="#162737")
            with Image.open(path) as source:
                preview = source.copy()
                preview.thumbnail((384, 605))
                canvas.paste(preview, (x + (400 - preview.width) // 2, y + 32))
        canvas.save(output / f"overview-{width}-{offset // 6 + 1:02}.png")
    # Keep the opening viewport at source resolution. For long landing pages,
    # place successive readable strips in three columns instead of squeezing
    # the full mobile page into a tiny thumbnail.
    with Image.open(root / str(width) / "home-classic.png") as source:
        source.crop((0, 0, width, min(1000, source.height))).save(output / f"hero-{width}.png")
        strip_width = min(width, 480)
        strip_height = 1000
        segment_height = round(strip_height * width / strip_width)
        segments = math.ceil(source.height / segment_height)
        canvas = Image.new("RGB", (strip_width * 3, math.ceil(segments / 3) * (strip_height + 30)), "#f2f5f8")
        draw = ImageDraw.Draw(canvas)
        for index in range(segments):
            top = index * segment_height
            bottom = min(source.height, top + segment_height)
            crop = source.crop((0, top, width, bottom))
            crop = crop.resize((strip_width, round(crop.height * strip_width / width)))
            x, y = (index % 3) * strip_width, (index // 3) * (strip_height + 30)
            draw.text((x + 8, y + 8), f"{width}px / y{top}-{bottom}", fill="#162737")
            canvas.paste(crop, (x, y + 30))
        canvas.save(output / f"landing-strips-{width}.png")
    print(f"{width}px: {len(paths)} captures")
print(f"Prepared {count} source captures for manual review in {output}")
