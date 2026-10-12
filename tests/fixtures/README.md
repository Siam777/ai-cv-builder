# Synthetic file diagnostic fixtures

`diagnostics-empty.pdf` is a single blank A4 page. `diagnostics-encrypted.pdf` is the same blank page with the synthetic password `Synthetic-fixture-password`. Neither file contains candidate data. They verify that an empty page is a diagnostic issue, an empty-text import is rejected and encrypted files cannot receive an extraction verdict.

Regenerate with Python and pypdf:

```python
from pathlib import Path
from pypdf import PdfWriter
root = Path("tests/fixtures")
for encrypted in (False, True):
    writer = PdfWriter()
    writer.add_blank_page(width=595.2756, height=841.8898)
    if encrypted:
        writer.encrypt("Synthetic-fixture-password")
    writer.write(root / ("diagnostics-encrypted.pdf" if encrypted else "diagnostics-empty.pdf"))
```

Other malformed DOCX/XML, duplicate source facts and generated resume cases are constructed directly by `tests/file-diagnostics.test.ts`. These fixtures support parser checks; they are not the planned recruiting/evidence benchmark.
