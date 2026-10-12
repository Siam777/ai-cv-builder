"""Audit authenticated DOCX fixture packages after the template browser suite.
Checks editable structure/content; visual Word/LibreOffice review is separate.
"""
import json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{" + NS["w"] + "}"
manifests = sorted(path for path in Path("test-results").glob("server-*.json") if not path.stem.startswith(("server-starter-", "server-letter-", "server-stress-")))
assert manifests, "Run the template browser tests first."
for manifest in manifests:
    expected = json.loads(manifest.read_text(encoding="utf-8"))
    path = manifest.with_suffix(".docx")
    with ZipFile(path) as package:
        assert package.testzip() is None, f"ZIP checksum failure: {path}"
        for name in package.namelist():
            if name.endswith((".xml", ".rels")):
                ET.fromstring(package.read(name))
        document = ET.fromstring(package.read("word/document.xml"))
        paragraphs = []
        for paragraph in document.findall(".//w:body/w:p", NS):
            text = ""
            for node in paragraph.iter():
                if node.tag == W + "t":
                    text += node.text or ""
                elif node.tag == W + "br":
                    text += "\n"
            paragraphs.append(text)
        assert paragraphs == expected["text"], f"Changed/reordered text: {path}"
        assert document.findall(".//w:numPr", NS), f"Missing editable lists: {path}"
        assert document.findall(".//w:hyperlink", NS), f"Missing contact links: {path}"
        assert document.findall(".//w:footerReference", NS), f"Missing free footer: {path}"
        assert "Created with AI CV Builder" not in "".join(paragraphs)
        footer = ET.fromstring(package.read("word/footer1.xml"))
        assert "Created with AI CV Builder" in "".join(footer.itertext())
        settings = expected["presentation"]
        page = document.find(".//w:pgSz", NS)
        width, height = (215.9, 279.4) if settings["pageSize"] == "Letter" else (210, 297)
        assert int(page.get(W + "w")) == round(width * 1440 / 25.4)
        assert int(page.get(W + "h")) == round(height * 1440 / 25.4)
        margin = {"airy": 19, "balanced": 16, "compact": 14, "tight": 12}[settings["density"]]
        margins = document.find(".//w:pgMar", NS)
        assert all(int(margins.get(W + side)) == round(margin * 1440 / 25.4)
                   for side in ("top", "bottom", "left", "right"))
        styles = ET.fromstring(package.read("word/styles.xml"))
        assert styles.find(".//w:docDefaults/w:rPrDefault/w:rPr/w:sz", NS).get(W + "val") == str(settings["fontSize"] * 2)
        assert {node.get(W + "val") for node in styles.findall(".//w:outlineLvl", NS)} == {"0", "1"}
    print(f"{path.name}: exact paragraph order, editable lists/headings, links, paper/margins, footer and XML verified")
