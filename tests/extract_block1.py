"""Read Block 1 inputs and LibreOffice-calculated outputs from the workbook."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
W = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

IDS = [
    "canopy", "cultivar", "floor", "soil", "drainage", "irrigation",
    "crop", "pest", "disease", "roots", "water", "nutrition",
]
SITE_COLS = {
    "canopy": "C", "floor": "D", "soil": "E", "drainage": "F", "crop": "G",
    "pest": "H", "disease": "I", "roots": "J", "water": "K", "nutrition": "L",
}


def cells_of(book, sheet_name):
    shared = []
    if "xl/sharedStrings.xml" in book.namelist():
        root = ET.fromstring(book.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter(W + "t")))
    workbook = ET.fromstring(book.read("xl/workbook.xml"))
    rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    target = None
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        if sheet.attrib["name"] == sheet_name:
            ref = targets[sheet.attrib[REL + "id"]]
            target = ref if ref.startswith("xl/") else "xl/" + ref
    root = ET.fromstring(book.read(target))
    out = {}
    for cell in root.iter(W + "c"):
        ref = cell.attrib.get("r")
        value = cell.find(W + "v")
        if value is None or value.text is None:
            continue
        if cell.attrib.get("t") == "s":
            out[ref] = shared[int(value.text)]
        else:
            out[ref] = float(value.text)
    return out


def num(cells, ref):
    value = cells.get(ref)
    return value if isinstance(value, float) else None


def main():
    book = zipfile.ZipFile(sys.argv[1])
    block = cells_of(book, "Block 1")
    summary = cells_of(book, "Summary")
    sites = []
    for row in range(12, 18):
        ratings = {}
        present = False
        for key, col in SITE_COLS.items():
            value = num(block, f"{col}{row}")
            if value is not None and value > 0:
                ratings[key] = value
                present = True
        share = num(block, f"B{row}")
        if share is not None:
            present = True
        if present:
            sites.append({"share": share or 0, "ratings": ratings})
    potentials = {}
    current_ratings = {}
    contributions = {}
    potential_contributions = {}
    uplift = {}
    for offset, key in enumerate(IDS):
        row = 22 + offset
        potentials[key] = num(block, f"D{row}")
        current_ratings[key] = num(block, f"C{row}")
        contributions[key] = num(block, f"E{row}")
        potential_contributions[key] = num(block, f"F{row}")
        uplift[key] = num(block, f"G{row}")
    print(json.dumps({
        "sites": sites,
        "blockRatings": {"cultivar": num(block, "C23"), "irrigation": num(block, "C27")},
        "potentialRatings": potentials,
        "uplifts": {"r1": num(summary, "J12"), "r2": num(summary, "J13"), "r3": num(summary, "J14")},
        "computed": {
            "currentRatings": current_ratings,
            "contributions": contributions,
            "potentialContributions": potential_contributions,
            "upliftPp": uplift,
            "weightSum": num(block, "B35"),
            "current": num(block, "E35"),
            "potential": num(block, "F35"),
            "managementUpliftPp": num(block, "G35"),
            "finalConditional": num(summary, "I5"),
        },
    }))


if __name__ == "__main__":
    main()
