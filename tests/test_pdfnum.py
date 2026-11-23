"""Page numbers on the report PDF (pdfnum.py, /pdf-numbers). Run: python3 tests/test_pdfnum.py"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pypdf import PageObject, PdfReader, PdfWriter
from pypdf.generic import (ArrayObject, DecodedStreamObject, DictionaryObject, FloatObject, NameObject, NumberObject,
                           TextStringObject)

import pdfnum

N = [0]


def ok(cond, msg=""):
    assert cond, msg
    N[0] += 1


def make_pdf(pages, width=595.28, height=841.89, rotate=0, link=True, origin=(0, 0)):
    """A small report-like PDF: one line of text per page, a web link on page 1."""
    w = PdfWriter()
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica")})
    for i in range(pages):
        p = PageObject.create_blank_page(width=width, height=height)
        if origin != (0, 0):
            p.mediabox = ArrayObject([FloatObject(origin[0]), FloatObject(origin[1]),
                                      FloatObject(origin[0] + width), FloatObject(origin[1] + height)])
        s = DecodedStreamObject()
        s.set_data(f"BT /F1 11 Tf {origin[0] + 40} {origin[1] + height - 60} Td (Report body, sheet {chr(65 + i % 26)}) Tj ET".encode())
        p[NameObject("/Contents")] = s
        p[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        if rotate:
            p[NameObject("/Rotate")] = NumberObject(rotate)
        page = w.add_page(p)
        if link and i == 0:
            annot = DictionaryObject({
                NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Link"),
                NameObject("/Rect"): ArrayObject([FloatObject(40), FloatObject(700), FloatObject(200), FloatObject(720)]),
                NameObject("/A"): DictionaryObject({NameObject("/S"): NameObject("/URI"),
                                                    NameObject("/URI"): TextStringObject("https://example.com/source")})})
            page[NameObject("/Annots")] = ArrayObject([w._add_object(annot)])
    out = io.BytesIO()
    w.write(out)
    return out.getvalue()


def texts(data):
    return [(p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages]


# 1. Every page gets "page / pages"; the text that was there stays
src = make_pdf(12)
out, total = pdfnum.number_pages(src)
ok(total == 12)
before, after = texts(src), texts(out)
ok(len(after) == 12)
for i in range(12):
    ok(f"{i + 1} / 12" in after[i], f"page {i + 1}: {after[i]!r}")
    ok(before[i].strip() in after[i], f"page {i + 1} lost its text")
    ok(after[i].count(" / 12") == 1, "one number a page")

# 2. Where the number sits: bottom right, inside the page, in the bottom margin
r = PdfReader(io.BytesIO(out))
found = []
for i, p in enumerate(r.pages):
    def visit(text, cm, tm, font_dict, font_size, i=i):
        if text and f"/ 12" in text:
            found.append((i, float(tm[4]), float(tm[5]), font_size))
    p.extract_text(visitor_text=visit)
ok(len(found) == 12, f"numbers found by position: {len(found)}")
for i, x, y, size in found:
    w_text = pdfnum._text_width(f"{i + 1} / 12")
    ok(abs((x + w_text) - (595.28 - pdfnum.RIGHT)) < 0.6, f"page {i + 1}: right edge at {x + w_text:.1f}")
    ok(abs(y - pdfnum.BOTTOM) < 0.1 and y < 40.82, f"page {i + 1}: baseline at {y}")
ok(found[0][1] > found[9][1], "a longer number starts further left (right-aligned)")

# 3. Links and page size are kept
p1 = r.pages[0]
annots = p1.get("/Annots")
ok(annots is not None and len(annots) == 1 and annots[0].get_object()["/A"]["/URI"] == "https://example.com/source", "link kept")
ok(abs(float(p1.mediabox.width) - 595.28) < 0.01 and abs(float(p1.mediabox.height) - 841.89) < 0.01, "page size kept")

# 4. One page; US Letter; a page box that does not start at 0,0; a rotated page
out1, t1 = pdfnum.number_pages(make_pdf(1))
ok(t1 == 1 and "1 / 1" in texts(out1)[0])
outL, tL = pdfnum.number_pages(make_pdf(3, width=612, height=792))
ok(tL == 3 and all(f"{i + 1} / 3" in t for i, t in enumerate(texts(outL))))
outO, _ = pdfnum.number_pages(make_pdf(2, origin=(30, 50)))
pos = []
PdfReader(io.BytesIO(outO)).pages[1].extract_text(visitor_text=lambda t, cm, tm, fd, fs: pos.append((float(tm[4]), float(tm[5]))) if t and "/ 2" in t else None)
ok(pos and abs(pos[0][1] - (50 + pdfnum.BOTTOM)) < 0.1 and pos[0][0] > 30 + 500, f"offset page box: {pos}")
outR, tR = pdfnum.number_pages(make_pdf(2, rotate=90))
ok(tR == 2 and all(f"{i + 1} / 2" in t for i, t in enumerate(texts(outR))), "rotated pages are numbered")

# 5. Numbering twice does not break the file (it adds a second number: the stage calls once)
out2, t2 = pdfnum.number_pages(out)
ok(t2 == 12 and len(texts(out2)) == 12)

# 6. Files that cannot be numbered say why
for bad, why in ((b"not a pdf at all", "could not be read"), (b"%PDF-1.4\n%%EOF", "")):
    try:
        pdfnum.number_pages(bad)
        ok(False, "should have failed")
    except ValueError as e:
        ok(why in str(e), str(e))
enc = PdfWriter(); enc.append(PdfReader(io.BytesIO(make_pdf(1)))); enc.encrypt("secret"); b = io.BytesIO(); enc.write(b)
try:
    pdfnum.number_pages(b.getvalue()); ok(False, "an encrypted file should fail")
except ValueError as e:
    ok("password" in str(e), str(e))

# 7. The route
os.environ["JML_API_KEY"] = "test-key"
import importlib
import app as appmod
importlib.reload(appmod)
c = appmod.app.test_client()
ok(c.get("/health").get_json().get("pdf_numbers") is True, "health says the deploy has page numbers")
ok(c.post("/pdf-numbers", data=src, content_type="application/pdf").status_code == 401, "no key, no service")
H = {"X-API-Key": "test-key"}
rv = c.post("/pdf-numbers", data=src, content_type="application/pdf", headers=H)
ok(rv.status_code == 200 and rv.mimetype == "application/pdf" and rv.headers.get("X-Pages") == "12" and rv.data[:4] == b"%PDF")
ok("12 / 12" in texts(rv.data)[11])
ok(c.post("/pdf-numbers", data=b"<html>no</html>", content_type="text/html", headers=H).status_code == 400)
rv = c.post("/pdf-numbers", data=b"%PDF-1.4\n%%EOF", content_type="application/pdf", headers=H)
ok(rv.status_code == 422 and rv.get_json().get("error"), "a broken PDF answers 422 with a reason")
ok(c.post("/pdf-numbers", data=b"", headers=H).status_code == 400)

print(f"{N[0]} checks passed")
