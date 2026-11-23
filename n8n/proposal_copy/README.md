# Test copy of the proposal flow (n8n jVwdeA9u2TaNnJpG): the market research wiring (plan step 6)

Copies of the Code nodes that step 6 added to or changed in "TEST: Proposal flow (step 6)", with offline tests.
**The workflow in n8n is the source of truth.** The live flow (Id8uRq0GgHDg7NBV) and the live "JML send reply"
(r9jj45wlxwYMlN1p) are not changed.

| File | Node |
|---|---|
| research_input.js | Research input: what the market research is asked for; no confirmed website, no research. Makes the run id and sets the time limit |
| parent_start.js | "Start" of the research parent (Krt2web1P1RxyWii): takes the run id from the caller |
| research_state.js | Research state: reads the research's rows in run_log and says done, failed, timeout or wait |
| assemble_market.js | Assemble market (new code, same name): findings and warnings for the rest of the flow, plus `research` |
| research_into_payload.js | Research into payload: the deck request becomes a template 1.5.4 request with the two research slides, the logos and the client colour |
| attachments.js | Attachments: the deck plus the report PDF, and the notes of the email |
| read_attachments.js | Read attachments: the files of the reply as base64 (several files) |
| build_mime.js | Build MIME: the email itself; a test brief becomes a draft |

Tests without n8n: `node n8n/proposal_copy/t_wiring.js` (34 checks) and `node n8n/proposal_copy/t_reply.js` (46 + 3 checks).

## The time limit

The flow no longer waits inside the research. "Market research" starts the research parent (Krt2web1P1RxyWii) with
a run id made by "Research input" and returns at once. Then a loop: wait 20 seconds, read the rows of that run in
run_log, ask "Research state".

| State | When | What the flow does |
|---|---|---|
| done | the parent's row has an outcome other than "running" | Slide values, client colour, then on. The result (report, PDF) is read from the row's `result_json` |
| failed | the crawl's row ended in error | goes on without the research slides |
| timeout | 12 minutes after the start (`research_limit_s` = 720) | goes on without the research slides; the research may still end later, its report stays in Drive |
| wait | none of these | another 20 seconds |

For this the research parent takes an optional `run_id` input and writes its result as JSON into the new column
`result_json` of its end row in run_log.

Not covered: a research that stops with an error other than an unreadable website leaves its row at "running", so
the flow waits the full 12 minutes before it goes on.

A test brief may shorten the limit: `research_limit_s` (20 to 720) in its body. Real emails always get 720.

## The reply

After the deck is built: "Report to attach?" (the research filled a slide and there is a PDF) -> "Download report"
(Google Drive, by file id) -> "Attachments". Attachments puts the deck and the report on one item and writes the
notes of the email:

| Case | Line in the email |
|---|---|
| slides filled, PDF fetched | The market research behind the two research slides is attached as a PDF, with its sources. |
| slides filled, PDF not fetched | The market research report could not be attached this time. The two research slides name their sources. |
| a field shows "not public", or a competitor column holds no claim (step 7) | The research was thin on some points: where a slide says "not public" or "no claims captured", no public source was found. |
| time limit passed | The market research was still running when this draft had to leave, so the deck has no market research slides. |
| website not readable | The client's website could not be read, so the deck has no market research slides. |
| research ran, nothing for the slides | The market research found nothing it could source, so the deck has no market research slides. |
| research not run | No market research was run, so the deck has no market research slides. (plus why, unless the flow already says the client was not confirmed) |
| deck not repainted | This deck is in JML colours ... Reply with the client's main colour as a HEX code ... |

The sentence of the 1.5 deck ("No market finding passed the source checks ...") is removed from the flow's notes.

The live "JML send reply" attaches one file, so the copy builds the reply itself: "Reply with deck: request" ->
"Read attachments" -> "Test brief?" -> ("Get original" ->) "Build MIME" -> "Draft or send?" -> "Send" or
"Save as draft". Read attachments and Build MIME are the live code of "JML send reply" with two changes: several
files, and a draft when there is no email to answer. "Reply with deck" (the call to "JML send reply") is switched
off, not deleted.

**A test brief sends nothing.** Its reply is saved as a draft in José's Gmail, addressed to joseliverio@jml-ops.com
only, with both files. A real email is answered in its thread, as before.

The email that holds a draft for review ("Send for review") gets a link to the report and the notes the reply
would carry; its attachment is still the deck alone.

Open for step 8: either the live "JML send reply" takes these two nodes (old requests still work: one file, old
field names), or the reply stays inside the proposal flow.

Working record of the step: project note `Plan_Step6_Wiring_Nov23.md`.

## Product in focus (23 Nov, after step 7)

"Research input" passes the Client Profiler's `product` to the research when the brief is about an offering
(`problem_focus` offering or both); a brief about a topic passes nothing and the research describes the client's lead
product, as before. For this the research stage "3 Position and product" (faD59YwI10ucFYob) now declares
`product_in_focus` as an input of its trigger: the parallel parent always sent it, but the trigger dropped it, so the
model always heard "The request names no product in focus". Step 7 showed the effect: for a brief on small business
lending, Millennium bcp's slides compared current accounts and cards with four digital banks.

`cost_parse.py`: reads the token use of every model call from saved n8n execution results (used for step 7).

## The product in focus, end to end (23 Nov, Millennium bcp re-tests)

Three re-tests of the Millennium bcp brief found four places where the brief's subject was lost on its way to the
research. All four are fixed; the last live re-test could not finish (n8n Gateway credits ran out at 23:33 UTC).

| # | Where | What was wrong | Fix |
|---|---|---|---|
| 1 | Research input (this copy) | sent no product | sends the Client Profiler's product |
| 2 | Research input | the Profiler classed the same brief once as offering, once as topic, and names a product only for an offering | falls back to the Profiler's market phrase |
| 3 | "3 Position and product", trigger | declared no `product_in_focus` input, so the parallel parent's value was dropped | input declared (seen arriving in Start, executions 4129 and 4147) |
| 4 | "3 Position and product", Prepare | read the product from "Log start", the run_log row, which has no such column: the model always read "The request names no product in focus" | reads it from Start (`position_prepare.js`, `t_prepare.js`, 2 checks) |

Also changed in "3 Position and product": the model keeps a product the request names even when no passage
describes it (`position_prompt.txt`). Millennium bcp's 60 crawled pages hold only personal banking; without this the
model would again fall back to the current account.
