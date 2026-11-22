# JML research: 4c Competitors (n8n workflow qs1fygSupa3zsx03)

Copies of the Code nodes, instructions and schemas changed by **Batch C** (22 Nov 2026), with an offline test.
**The workflow in n8n is the source of truth.** These files were compared with what n8n stored after the update
(version 5638e986): identical.

| File | Node |
|---|---|
| queries.js | Queries |
| rank.js | Rank |
| site_queries.js | Site queries |
| site_sources.js | Site sources |
| site_pages.js | Site pages |
| build.js | Build entries |
| rows_only.js | Rows only |
| list_rows.js | List rows |
| summary.js | Summary |
| prompts.py | Name the competitors and Light check: instruction, request and answer schema |

Not copied here because Batch C did not change them: Start, Sources, Pages and the nodes that only read or write a table.

Test without n8n (78 checks):

    node n8n/competitors/t_queries.js && node n8n/competitors/t_chain.js

`t_queries.js` uses the rows of two real research runs kept in `../slide_values/`.

## What Batch C does

1. **The company's country.** Queries works it out: the country ending of its web address (.pt, .nl; endings used by
   anyone such as .co, .io, .ai say nothing), else the language of its pages when only one country fits (or one of
   its markets), else its only market. When a country is known, all three searches carry its name and Brave's
   country code. When it is not, the searches are the same as before.
2. **Who sells there.** The naming model says for each company whether the page shows it sells in that country
   (yes, no, unknown). Code leaves out "no", and ranks "yes" before "unknown".
3. **Each company's own site.** Eight candidates go to the site step instead of five. The site is the address the
   source page gave, or the search result whose address fits the name (exact, starts with, initials). A shop, an app
   store or a directory is never a company's site, unless the company is that shop.
4. **One site, one company.** Names that share a site are merged. A name with no site of its own is left out.
5. **The page is theirs and the offer is related.** The light check says whether the page read belongs to the named
   competitor and whether it serves the same need. If not, the name is left out and the next candidate moves up.
6. The final five are numbered 1 to 5. The `competitors` table is now written at the end, with the final list.
7. Fixed on the way: the old code read the entry A4-MODEL ("Pricing model: ...") as a market and searched for it.

Entry format is unchanged (the slide values stage and Code checks read it).
