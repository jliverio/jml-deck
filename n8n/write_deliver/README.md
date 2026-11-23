# JML research: 8 Write and deliver (n8n workflow 3Zw4vOdZFwkK7Iyb)

Copies of the Code nodes that **plan step 4** (23 Nov 2026) added or changed, with an offline test.
**The workflow in n8n is the source of truth.**

| File | Node |
|---|---|
| upload_request.js | Upload request (now also hands on the folder id) |
| pdf_details.js | PDF details (new) |
| summary.js | Summary |

Not copied here: the other nodes of the stage, which step 4 did not change.

Test without n8n (21 checks):

    node n8n/write_deliver/t_pdf.js

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
