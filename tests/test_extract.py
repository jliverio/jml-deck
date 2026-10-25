"""Attachment reader (/extract, email plan E6): PDF page cap, Word text and tables, unsupported and broken files.
Usage: python3 tests/test_extract.py"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ["JML_API_KEY"] = "k"
import app  # noqa: E402
import extract  # noqa: E402

app.API_KEY = "k"
c = app.app.test_client()
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


def pdf(pages):
    """A minimal PDF with one line of text per page (no PDF library needed)."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for i in range(pages):
        stream = f"BT /F1 12 Tf 72 720 Td (Brief page {i + 1} for Ribeira Logistics) Tj ET".encode()
        objs.append(f"<< /Length {len(stream)} >>\nstream\n".encode().decode() + stream.decode() + "\nendstream")
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {len(objs)} 0 R "
                    f"/Resources << /Font << /F1 3 0 R >> >> >>")
        kids.append(len(objs))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {pages} >>"
    out, offs = io.BytesIO(), []
    out.write(b"%PDF-1.4\n")
    for i, o in enumerate(objs, 1):
        offs.append(out.tell())
        out.write(f"{i} 0 obj\n{o}\nendobj\n".encode())
    x = out.tell()
    out.write(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode())
    for o in offs:
        out.write(f"{o:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode())
    return out.getvalue()


def post(data, name, mime, key="k"):
    return c.post(f"/extract?name={name}", data=data, headers={"X-API-Key": key, "Content-Type": mime})


j = post(pdf(14), "brief.pdf", "application/pdf").get_json()
check("PDF: first 10 of 14 pages read, marked truncated",
      j["kind"] == "pdf" and j["pages_total"] == 14 and j["pages_read"] == 10 and j["truncated"]
      and "Brief page 10" in j["text"] and "Brief page 11" not in j["text"], {k: v for k, v in j.items() if k != "text"})
j = post(pdf(2), "short.pdf", "application/octet-stream").get_json()
check("PDF named by extension, short file not truncated", j["kind"] == "pdf" and not j["truncated"] and "page 2" in j["text"], j)

import docx  # noqa: E402
d = docx.Document()
d.add_paragraph("Ribeira Logistics wants to cut warehouse costs by 12% within 18 months.")
t = d.add_table(rows=2, cols=2)
t.cell(0, 0).text, t.cell(0, 1).text, t.cell(1, 0).text, t.cell(1, 1).text = "Site", "Staff", "Porto", "240"
d.add_paragraph("A diagnostic within 8 weeks.")
buf = io.BytesIO(); d.save(buf)
r = c.post("/extract", data={"file": (io.BytesIO(buf.getvalue()), "brief.docx")}, headers={"X-API-Key": "k"},
           content_type="multipart/form-data")
j = r.get_json()
check("Word (multipart): paragraphs and table in order",
      j["kind"] == "docx" and j["text"].split("\n") == [
          "Ribeira Logistics wants to cut warehouse costs by 12% within 18 months.", "Site | Staff", "Porto | 240",
          "A diagnostic within 8 weeks."], j["text"])
d2 = docx.Document()
for i in range(1200):
    d2.add_paragraph(f"Filler sentence number {i} about the operations work.")
buf2 = io.BytesIO(); d2.save(buf2)
j = post(buf2.getvalue(), "long.docx", extract.DOCX_MIME.copy().pop()).get_json()
check("Word: cut at about 10 pages (5,000 words), marked truncated",
      j["truncated"] and len(j["text"].split()) <= extract.MAX_WORDS_DOCX, (j["truncated"], len(j["text"].split())))
j = post(b"\x89PNG", "logo.png", "image/png").get_json()
check("image: not read, said so", j["kind"] == "unsupported" and j["text"] == "" and j["note"], j)
j = post(b"%PDF-1.4 garbage", "bad.pdf", "application/pdf").get_json()
check("broken PDF: empty text and a note, no error", r.status_code == 200 and j["text"] == "" and "could not be read" in j["note"], j)
check("wrong key: 401", post(b"x", "a.pdf", "application/pdf", key="no").status_code == 401)

failed = [x for x in results if not x[1]]
for name, ok, detail in results:
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -> {detail}"))
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
