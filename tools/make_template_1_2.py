"""
Build template 1.2 from template 1.1: slide 4 (Summary of our proposal) gets variables.

  Title 1                 section_01           -> summary_title_01
  Google Shape;881;p247   sample objectives    -> objective_01 .. objective_04 (one bullet each)
  Google Shape;882;p247   sample solution      -> solution_01 .. solution_05
  Google Shape;883;p247   sample outcomes      -> outcome_01 .. outcome_04

Each bullet keeps the first sample paragraph's formatting (bullet, 14 pt, spacing).
Everything else in the file is copied byte for byte.

Run:  python3 tools/make_template_1_2.py
"""
import copy
import io
import os
import re
import zipfile

from lxml import etree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "template_v1_1.potx")
DST = os.path.join(ROOT, "template_v1_2.potx")
NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
BOXES = {"Google Shape;881;p247": ("objective", 4),
         "Google Shape;882;p247": ("solution", 5),
         "Google Shape;883;p247": ("outcome", 4)}


def slide_part(z, number):
    pres = etree.fromstring(z.read("ppt/presentation.xml"))
    rels = etree.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
    rid = pres.findall("p:sldIdLst/p:sldId", NS)[number - 1].get("{%s}id" % NS["r"])
    target = [r.get("Target") for r in rels if r.get("Id") == rid][0]
    return "ppt/" + target.lstrip("/").replace("ppt/", "")


def edit(xml):
    root = etree.fromstring(xml)
    done = set()
    for sp in root.iter("{%s}sp" % NS["p"]):
        name = sp.find("p:nvSpPr/p:cNvPr", NS).get("name")
        body = sp.find("p:txBody", NS)
        if name == "Title 1":
            ts = body.findall(".//a:t", NS)
            assert len(ts) == 1 and ts[0].text == "section_01", "unexpected Title 1"
            ts[0].text = "summary_title_01"
            done.add(name)
        elif name in BOXES:
            prefix, n = BOXES[name]
            paras = body.findall("a:p", NS)
            proto = paras[0]
            for p in paras:
                body.remove(p)
            for k in range(1, n + 1):
                p = copy.deepcopy(proto)
                runs = p.findall("a:r", NS)
                for extra in runs[1:]:
                    p.remove(extra)
                runs[0].find("a:t", NS).text = f"{prefix}_{k:02d}"
                body.append(p)
            done.add(name)
    missing = {"Title 1", *BOXES} - done
    assert not missing, missing
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def main():
    src = zipfile.ZipFile(SRC)
    part = slide_part(src, 4)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == part:
                data = edit(data)
            dst.writestr(item, data)
    open(DST, "wb").write(buf.getvalue())
    print("wrote", DST, "slide part", part)


if __name__ == "__main__":
    main()
