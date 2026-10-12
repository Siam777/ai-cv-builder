"""Build local contact sheets for manually reviewing the synthetic UI baseline.

Run after the full browser suite. Full-size source PNGs stay beside manifests;
contact sheets supplement those images and the automated overflow checks.
"""
import json
import math
import argparse
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--pdfs", action="store_true", help="Also render representative print-fixture pages with Poppler")
parser.add_argument("--root", type=Path, default=Path("test-results/visual-baseline"), help="Capture root containing width/state manifests (e.g. test-results/dashboard)")
args = parser.parse_args()

root = args.root
output = root / "review"
output.mkdir(exist_ok=True)
for manifest_path in sorted(root.glob("*/manifest.json")):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    records = manifest["records"]
    for offset in range(0, len(records), 6):
        batch = records[offset:offset + 6]
        canvas = Image.new("RGB", (1200, math.ceil(len(batch) / 3) * 680), "#e9ece7")
        draw = ImageDraw.Draw(canvas)
        for index, record in enumerate(batch):
            x, y = (index % 3) * 400, (index // 3) * 680
            draw.text((x + 12, y + 8), f'{manifest["width"]}px - {record["state"]}', fill="#152f28")
            with Image.open(record["path"]) as source:
                preview = source.copy()
                preview.thumbnail((384, 640))
                canvas.paste(preview, (x + (400 - preview.width) // 2, y + 30))
        canvas.save(output / f'{manifest["width"]}-{offset // 6 + 1:02}.png')
    print(f'{manifest["width"]}px: {len(records)} captures; overflow findings: ' +
          str([record["state"] for record in records if record["overflow"] > 1 or record["dialogOverflow"] > 1 or record.get("clippedControls")]))

if args.pdfs:
    from pypdf import PdfReader
    pdf_output = output / "pdfs"
    pdf_output.mkdir(exist_ok=True)
    samples = []
    # Sampling is intentional: this baseline does not certify every rendered
    # page or establish parity with the separate authenticated server renderer.
    for pattern, use_last in [("*-short-A4.pdf", False), ("*-long-A4-airy.pdf", False), ("*-long-Letter-tight.pdf", True)]:
        for path in sorted(Path("test-results").glob(pattern)):
            number = len(PdfReader(path).pages) if use_last else 1
            target = pdf_output / f"{path.stem}-page-{number}"
            subprocess.run(["pdftoppm", "-f", str(number), "-singlefile", "-scale-to", "1400", "-png", str(path), str(target)], check=True)
            samples.append((f"{path.stem} p{number}", target.with_suffix(".png")))
    assert samples, "Run the template browser tests first."
    for offset in range(0, len(samples), 6):
        batch = samples[offset:offset + 6]
        canvas = Image.new("RGB", (1200, math.ceil(len(batch) / 3) * 590), "#e9ece7")
        draw = ImageDraw.Draw(canvas)
        for index, (label, path) in enumerate(batch):
            x, y = (index % 3) * 400, (index // 3) * 590
            draw.text((x + 12, y + 8), label, fill="#152f28")
            with Image.open(path) as source:
                preview = source.copy()
                preview.thumbnail((384, 548))
                canvas.paste(preview, (x + (400 - preview.width) // 2, y + 30))
        canvas.save(output / f"pdf-{offset // 6 + 1:02}.png")
    print(f"Rendered {len(samples)} representative print pages; full-size PNGs: {pdf_output}")
