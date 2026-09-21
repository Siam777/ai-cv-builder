"""Optional post-browser-test export audit. Requires pypdf.

Run after `npm run test:e2e`: python scripts/verify-pdfs.py
Render PDFs with Poppler as well; text assertions do not replace visual QA.
"""
import json
import re
import unicodedata
from pathlib import Path
from pypdf import PdfReader


def normalize(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", value)).casefold()


manifests = [path for path in Path("test-results").glob("*.json") if path.stem.startswith(("classic-", "modern-", "compact-", "creative-"))]
assert manifests, "Run the template browser tests first."
for manifest in sorted(manifests):
    expected = json.loads(manifest.read_text(encoding="utf-8"))
    path = manifest.with_suffix(".pdf")
    reader = PdfReader(path)
    assert len(reader.pages) == expected["pageCount"], f"Preview/print page count differs: {path}"
    texts = []
    for page in reader.pages:
        text = re.sub(r"(?m)^\d+\s*/\s*\d+\s*$", "", page.extract_text())
        assert text.strip(), f"Blank page: {path}"
        texts.append(text)
    body = normalize("\n".join(texts))
    position = 0
    for block in expected["text"]:
        index = body.find(normalize(block), position)
        assert index >= 0, f"Missing/reordered text in {path}: {block[:70]}"
        position = index + len(normalize(block))
    assert any(page.get("/Annots") for page in reader.pages), f"Missing contact links: {path}"
    size = (612, 792) if "Letter" in path.name else (595, 842)
    for page in reader.pages:
        assert abs(float(page.mediabox.width) - size[0]) < 1
        assert abs(float(page.mediabox.height) - size[1]) < 1
    print(f"{path.name}: {len(reader.pages)} pages; exact text order, preview parity, paper size, links verified")
