# JML research: 4c Competitors (n8n workflow qs1fygSupa3zsx03)

Copies of the Code nodes, instructions and schemas changed by **Batch C** (22 Nov 2026), with an offline test.
**The workflow in n8n is the source of truth.** These files were compared with what n8n stored after the update
(version of 22 Nov 23:53 UTC, after the fixes that the seven real runs called for): identical.

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

Test without n8n (104 checks):

    node n8n/competitors/t_queries.js && node n8n/competitors/t_chain.js

`t_queries.js` uses the rows of two real research runs kept in `../slide_values/`.

## What Batch C does

1. **The company's country.** Queries works it out: the country ending of its web address (.pt, .nl; endings used by
   anyone such as .co, .io, .ai say nothing), else the language of its pages when only one country fits (or one of
   its markets), else its only market. When a country is known, all three searches carry its name and Brave's
   country code. When it is not, the searches are the same as before.
2. **Who sells there.** The naming model says for each company whether the page shows it sells in that country
   (yes, no, unknown). Code leaves out "no", and ranks "yes" before "unknown".
3. **Each company's own site.** Up to eight candidates go to the site step instead of five (seven when three
   searches were run, five when five were: the stage stays within its budget of 10 searches, which Code checks
   enforces). The site is the address the source page gave, or the search result whose address fits the name on
   whole words: the name itself, the name with a common added word (shop, get, app, usa, a country code), its
   first words, its initials, or one distinctive word of it. A shop, an app store or a directory is never a
   company's site, unless the company is that shop. An app or sign-in address gives the home page. `www` is kept.
4. **One site, one company.** Names that share a site are merged. A name with no site of its own is left out.
5. **The page is theirs and the offer is related.** The light check says whether the page read belongs to the named
   competitor and whether it serves the same need. If not, the name is left out and the next candidate moves up.
   An address that is exactly the company's name is taken as its own site whatever the check says.
   The country of a competitor is taken from its home page only when the page says where its head office is,
   and only when the page read is the address asked for (a world site can answer with a national one).
   "Same need" means the same field, not the exact product: a large company with many products stays; only a
   different trade altogether (an identity-check firm, a general shop) goes.
   Two candidates whose pages land on the same site, or name the same company, also count once.
6. The final five are numbered 1 to 5. The `competitors` table is now written at the end, with the final list.
   Of the spellings of a merged name the most frequent is kept. On a full tie a direct competitor goes before a substitute.
7. Fixed on the way: the old code read the entry A4-MODEL ("Pricing model: ...") as a market and searched for it.

Entry format is unchanged (the slide values stage and Code checks read it).
