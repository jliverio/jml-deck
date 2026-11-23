# JML research: 8 Write and deliver (n8n workflow 3Zw4vOdZFwkK7Iyb)

Copies of the Code nodes that **plan step 4** (23 Nov 2026) added or changed, with an offline test.
**The workflow in n8n is the source of truth.**

| File | Node |
|---|---|
| upload_request.js | Upload request (now also hands on the folder id) |
| pdf_details.js | PDF details (new) |
| summary.js | Summary |
| parent_summary.js | Summary of the parallel parent (Krt2web1P1RxyWii) |

Not copied here: the other nodes of the stage, which step 4 did not change.

Test without n8n (21 + 4 checks):

    node n8n/write_deliver/t_pdf.js && node n8n/write_deliver/t_parent.js

## What step 4 does

After the Google Doc is created and set to A4, the stage makes a PDF copy of it:

1. **PDF details** builds the file name: the date researched, the client name, `Market_Research`.
   Example: `20261123_Equal_Food_Market_Research.pdf`. The date is the one the report shows (the day the research
   ended, UTC). The name holds plain letters and digits only: accents are dropped, anything else becomes `_`.
2. **Export as PDF** asks Google Drive for the Doc as a PDF (one call, the same Google account as the Doc).
3. **Save the PDF** stores it in the same place as the Doc: the folder named in the input, else My Drive.
4. **Read the PDF** (a side node) reads the PDF back and counts its pages and words.
5. **Summary** returns `pdf_file_id`, `pdf_name`, `pdf_url`, `pdf_pages`, `pdf_words`, `pdf_size_kb` and `pdf_note`.
   The stage ends "partial" when the PDF could not be made, or when it holds under 80% of the report's words.
   If only the read-back fails, the PDF is still saved and handed on, and the note says it was not checked.

The parallel parent (Krt2web1P1RxyWii) hands `pdf_file_id`, `pdf_name` and `pdf_url` on in its own result, and lists
"the PDF of the report was not made" among the reasons for a partial run. The proposal flow (plan step 6) attaches
the PDF by its file id.

Not done by this step: page numbers. Google's API cannot add them to a Doc, so the PDF has none.

## Page numbers (built, not switched on yet)

José asked for page numbers on the PDF (23 Nov). Google's API cannot put them in a Doc, so the renderer writes
"3 / 10" at the bottom right of every page of the exported PDF: `pdfnum.py` and `POST /pdf-numbers` (commit cf7a20d,
81 checks in `tests/test_pdfnum.py`). The Doc itself stays without numbers.

The n8n side is ready in `pending_page_numbers/` and is **not stored in n8n yet**:

| File | Node |
|---|---|
| pick_pdf.js | Pick the PDF (new): the numbered PDF when the renderer returned one, else the PDF as Google exported it |
| summary.js | Summary: adds `pdf_numbered` and `pdf_numbers_seen`; the note says how many pages carry a number |
| t_pdf.js | offline test, 31 checks: `node n8n/write_deliver/pending_page_numbers/t_pdf.js` |

Wiring to add: Log start -> Wake renderer (side node); Export as PDF -> Number the pages (POST /pdf-numbers, the PDF
as the body) -> Pick the PDF -> Read the PDF and Save the PDF. A failed call never blocks the report: the PDF is
saved without numbers and the note says why.

It waits for two things: one Render deploy, and an n8n credential of type "Header Auth" holding the renderer's key
(header name `X-API-Key`). The key is not copied into the node by hand.
