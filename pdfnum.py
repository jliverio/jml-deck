"""
Page numbers on a PDF (23 Nov 2026, plan step 4).

The research report is a Google Doc, and Google's API cannot put page numbers in a Doc. So the report stage exports
the Doc as a PDF and posts it here; this module writes "3 / 10" at the bottom right of every page and returns the
PDF. Nothing else on the page changes: the text, links and bookmarks of the PDF stay as Google wrote them.

The number sits in the bottom margin (the report's is 1.44 cm), right-aligned with the text column (0.63 cm from the
edge), in 9 pt grey Helvetica, one of the fonts every PDF reader has, so no font file is needed.
"""
import io

from pypdf import PageObject, PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

SIZE = 9.0        # points
GREY = 0.42       # 0 = black, 1 = white
RIGHT = 17.86     # points from the right edge: the report's side margin
BOTTOM = 17.0     # points from the bottom edge to the baseline
MAX_PAGES = 400   # a report is about ten pages; this only stops a file that is not one

# Helvetica widths (per 1000 units of font size) of the only characters written: digits, space and slash.
_WIDTH = {" ": 278, "/": 278}
_WIDTH.update({str(d): 556 for d in range(10)})


def _text_width(text):
    return sum(_WIDTH[c] for c in text) * SIZE / 1000.0


def number_pages(data):
    """bytes of a PDF -> (bytes of the same PDF with "page / pages" on every page, number of pages).
    Raises ValueError with a plain reason when the file cannot be numbered."""
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise ValueError(f"the file could not be read as a PDF ({type(e).__name__})")
    if reader.is_encrypted:
        raise ValueError("the PDF is password-protected")
    writer = PdfWriter()
    writer.append(reader)          # pages with their links and bookmarks
    total = len(writer.pages)
    if not total:
        raise ValueError("the PDF has no pages")
    if total > MAX_PAGES:
        raise ValueError(f"the PDF has {total} pages; the limit is {MAX_PAGES}")
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"), NameObject("/Encoding"): NameObject("/WinAnsiEncoding")})
    for i, page in enumerate(writer.pages):
        if page.rotation:
            page.transfer_rotation_to_content()     # so "bottom right" is where the reader sees it
        box = page.mediabox
        left, bottom, width, height = float(box.left), float(box.bottom), float(box.width), float(box.height)
        text = f"{i + 1} / {total}"
        x = left + width - RIGHT - _text_width(text)
        y = bottom + BOTTOM
        stream = DecodedStreamObject()
        stream.set_data(f"q BT /JMLPageNo {SIZE:g} Tf {GREY:g} g {x:.2f} {y:.2f} Td ({text}) Tj ET Q\n".encode("ascii"))
        stamp = PageObject.create_blank_page(width=width, height=height)
        stamp.mediabox = box
        stamp[NameObject("/Contents")] = stream
        stamp[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/JMLPageNo"): font})})
        page.merge_page(stamp)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue(), total
