# JML research: 8 Write and deliver (n8n workflow 3Zw4vOdZFwkK7Iyb)

Copies of the Code nodes that **plan step 4** (23 Nov 2026) added or changed, with an offline test.
**The workflow in n8n is the source of truth.**

| File | Node |
|---|---|
| upload_request.js | Upload request (now also hands on the folder id) |
| pdf_details.js | PDF details (new) |
| summary.js | Summary |
| pick_pdf.js | Pick the PDF |
| parent_summary.js | Summary of the parallel parent (Krt2web1P1RxyWii) |

Not copied here: the other nodes of the stage, which step 4 did not change.

Test without n8n: see the end of this file.

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


## Page numbers (switched on 23 Nov, 15:47 UTC)

José asked for page numbers on the PDF. Google's API cannot put them in a Doc, so the renderer writes "3 / 10" at the
bottom right of every page of the exported PDF: `pdfnum.py` and `POST /pdf-numbers` (81 checks in
`tests/test_pdfnum.py`). The Doc itself stays without numbers.

| File | Node |
|---|---|
| pick_pdf.js | Pick the PDF: the numbered PDF when the renderer returned one, else the PDF as Google exported it |
| summary.js | Summary: `pdf_numbered` and `pdf_numbers_seen`; the note says how many pages carry a number |

Wiring: Log start -> Wake renderer (side node, no key); Export as PDF -> Number the pages (POST /pdf-numbers, the PDF
as the body, key from the n8n credential "JML renderer key") -> Pick the PDF -> Read the PDF and Save the PDF. A
failed call never blocks the report: the PDF is saved without numbers and the note says why.

First live run (Equal Food): 10 pages, "Page numbers on 10 of 10 pages", stage 38.5 s. The numbered file is larger
than Google's (1.3 MB against 0.25 MB): the library that writes the numbers does not pack the file as tightly.

Test without n8n (31 + 4 checks): `node n8n/write_deliver/t_pdf.js && node n8n/write_deliver/t_parent.js`
