"""Summarise a generated report for the verification script."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def text_of(el):
    return "".join(node.text or "" for node in el.iter(W + "t"))


def orient_of(sect):
    pg = sect.find(W + "pgSz")
    if pg is None:
        return "unknown"
    orient = pg.get(W + "orient")
    width = int(pg.get(W + "w") or 0)
    height = int(pg.get(W + "h") or 0)
    if orient == "landscape" or width > height:
        return "landscape"
    return "portrait"


def main():
    path = sys.argv[1]
    book = zipfile.ZipFile(path)
    xml = book.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find("w:body", NS)
    sections = []
    current = {"orientation": None, "headings": [], "text": []}
    for child in list(body):
        tag = child.tag.split("}")[-1]
        if tag in {"p", "tbl"}:
            style = child.find("w:pPr/w:pStyle", NS)
            style_id = style.get(W + "val") if style is not None else ""
            text = text_of(child).strip()
            if style_id in {"Heading1", "Heading2", "Heading3"} and text:
                current["headings"].append({"style": style_id, "text": text})
            if text:
                current["text"].append(text)
            sect = child.find("w:pPr/w:sectPr", NS)
            if sect is not None:
                current["orientation"] = orient_of(sect)
                sections.append(current)
                current = {"orientation": None, "headings": [], "text": []}
        elif tag == "sectPr":
            current["orientation"] = orient_of(child)
            sections.append(current)
    instr = [node.text or "" for node in root.iter(W + "instrText")]
    footers = []
    for name in book.namelist():
        if name.startswith("word/footer"):
            footer = ET.fromstring(book.read(name))
            footers.append({
                "name": name,
                "text": text_of(footer),
                "fields": [node.text or "" for node in footer.iter(W + "instrText")],
            })
    captions = [text for section in sections for text in section["text"] if text.startswith("Figure ") or text.startswith("Table ")]
    print(json.dumps({
        "bytes": __import__("os").path.getsize(path),
        "sections": [{
            "orientation": section["orientation"],
            "headings": section["headings"],
        } for section in sections],
        "fields": instr,
        "footers": footers,
        "captions": captions,
        "hasGridLegend": any("C = current recorded rating or range" in text for section in sections for text in section["text"]),
        "hasChangeColumn": any("Change needed for proposed rating" in text for section in sections for text in section["text"]),
    }))


if __name__ == "__main__":
    main()
