"""
Attachment reader for the intake workflow (email plan E6, Oct 25).

A partner may send the brief as a PDF or Word file. The intake posts each attachment here and adds the text to
the brief before the Brief Organizer reads it. Only the first pages are read: a 10-page cap on PDFs keeps one
448-page report from costing $3.55 again (CFO onboarding, worst build seen).

extract(data, name, mime) -> dict(name, kind, pages_total, pages_read, chars, truncated, text, note)
"""
import io
import re

MAX_PAGES = 10            # PDF pages read
MAX_WORDS_DOCX = 5000     # Word has no pages until it is laid out: about 10 pages of 500 words
MAX_CHARS = 25000         # per attachment, after the page cap

PDF_MIME = {"application/pdf", "application/x-pdf"}
DOCX_MIME = {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def _kind(name, mime):
    n = (name or "").lower()
    m = (mime or "").lower().split(";")[0].strip()
    if m in PDF_MIME or n.endswith(".pdf"):
        return "pdf"
    if m in DOCX_MIME or n.endswith(".docx"):
        return "docx"
    return "unsupported"


def _tidy(text):
    text = text.replace("\r", "\n").replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def _pdf(data):
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            return 0, 0, "", "The PDF is password-protected; nothing was read."
    total = len(reader.pages)
    parts = []
    for page in reader.pages[:MAX_PAGES]:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    text = _tidy("\n\n".join(parts))
    note = "" if text else "The PDF has no text layer (a scan?); nothing was read."
    return total, min(total, MAX_PAGES), text, note


def _docx(data):
    import docx
    doc = docx.Document(io.BytesIO(data))
    body = doc.element.body
    parts, words = [], 0
    # paragraphs and tables in document order
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            t = "".join(n.text or "" for n in child.iter() if n.tag.endswith("}t"))
        elif tag == "tbl":
            rows = []
            for tr in child.iter():
                if tr.tag.endswith("}tr"):
                    cells = []
                    for tc in tr:
                        if tc.tag.endswith("}tc"):
                            cells.append(" ".join("".join(n.text or "" for n in p.iter() if n.tag.endswith("}t"))
                                                  for p in tc if p.tag.endswith("}p")).strip())
                    rows.append(" | ".join(cells))
            t = "\n".join(rows)
        else:
            continue
        if not t.strip():
            continue
        w = len(t.split())
        if words + w > MAX_WORDS_DOCX:
            parts.append(" ".join(t.split()[: MAX_WORDS_DOCX - words]))
            words = MAX_WORDS_DOCX
            break
        parts.append(t)
        words += w
    text = _tidy("\n".join(parts))
    return None, None, text, "" if text else "The Word file has no text."


def extract(data, name="", mime=""):
    kind = _kind(name, mime)
    out = dict(name=name or "", kind=kind, pages_total=None, pages_read=None, chars=0, truncated=False, text="", note="")
    if kind == "unsupported":
        out["note"] = "Only PDF and Word (.docx) files are read."
        return out
    try:
        total, read, text, note = _pdf(data) if kind == "pdf" else _docx(data)
    except Exception as e:  # a broken file must never fail the intake
        out["note"] = f"The file could not be read ({type(e).__name__})."
        return out
    truncated = bool((total and read and total > read) or len(text) > MAX_CHARS
                     or (kind == "docx" and len(text.split()) >= MAX_WORDS_DOCX))
    if len(text) > MAX_CHARS:
        cut = text[:MAX_CHARS]
        text = cut[: cut.rfind(" ")] if " " in cut[-200:] else cut
    out.update(pages_total=total, pages_read=read, chars=len(text), truncated=truncated, text=text, note=note)
    return out
