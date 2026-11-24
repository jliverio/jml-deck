# Code checks of the research (n8n kUZvSlrkzDpndm73): copies of changed rules

"JML research: 5 Code checks" checks every entry of a research run with code only (format, quote on the stored page,
figure in the quote, source tier, dates, search budgets, gaps). **The workflow in n8n is the source of truth.** This
folder holds copies of the rules changed after the build, with offline tests.

| File | Node |
|---|---|
| rule3_figure_in_quote.js | Rule 3: figure in the quote |

Test without n8n: `node n8n/code_checks/t_rule3.js` (18 checks, on real entries of 23 Nov).

## Rule 3 knows Portuguese, Spanish and French scale words (24 Nov)

A figure stored as a number must appear in its quote. When the quote writes it with a scale word ("1.2 billion"),
only its leading digits must be there. The rule knew English scale words only, so Portuguese quotes failed:

| Run | Entry | Quote | Stored figure |
|---|---|---|---|
| Galp re-test, 23 Nov (n8n 4189) | Tesla, rank 1 | "81,462 mil milhões de dólares em 2022" | 81462000000 |
| Galp re-test, 23 Nov (n8n 4189) | ChargePoint, rank 3 | "153 milhões de dólares em Q1 2023" | 153000000 |
| Millennium bcp re-tests, 23 Nov (two runs) | Caixa Geral de Depósitos, rank 1 | "mais de 3,5 milhões de clientes ativos" | 3500000 |

A failed figure is left out of the report and its stage is not run again, so each of these companies vanished from
the comparison slide without a word in the email beyond "N entries failed the checks".

Now also counted as scale words: mil, milhão, milhões, mil milhões, bilhão, bilhões, millón, millones, milliard(s).
"mil" counts only as a word of its own ("família", "milhas" do not count). The test is the same as for English (the
leading digits), so the real failures of 23 Nov still fail: Shell, Chevron and bp in the Galp step 7 run (figures that
are not in their quotes at all), Equal Food's prices on quotes with no price, and two planted errors.

Known limit, as before: with a scale word in the quote, the magnitude is not checked (3,5 milhões would also accept
3,500,000,000).
