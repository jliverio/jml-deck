# JML research: 9 Slide values (n8n workflow CXkdnVjkucA0swLT)

Copies of the Code nodes of the stage that writes the values of the two market research slides (template 1.5.4),
with an offline test. **The workflow in n8n is the source of truth.** These files are what was stored there on
22 Nov 2026 (checked node by node after each update).

| File | Node |
|---|---|
| start.js | Start |
| build.js | Build the request |
| check.js | Check the values (runs after the writer and again after the rewrite) |
| decide.js | Decide |
| final.js | Final values |
| rows.js | Rows to save |
| summary.js | Summary |
| test_input.js | Test input |
| prompts.py | the two instructions and the two answer schemas |

Test without n8n (56 checks; rows of two real research runs of 22 Nov, model answers written by hand):

    node n8n/slide_values/t_prompt.js > /dev/null && node n8n/slide_values/t_check.js

`t_prompt.js` writes build_EqualFood.json and build_n8n.json, which `t_check.js` reads.

One difference to know: n8n stores `\uXXXX` escapes typed through the API as the characters themselves, so a
byte comparison of check.js needs the escapes decoded first.

Known, not yet changed: when a company has no claim of its own, PART 7 of the request points to "the format of
PART 6", which is then absent; the writer returns competitor points without labels and the rewrite repairs them
(one extra model call). Fix: spell the format out in PART 7.
