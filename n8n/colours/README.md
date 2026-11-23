# Client colours in the proposal flow (plan step 5, 23 Nov 2026)

Two rules written and tested for the flow. **Nothing here is stored in n8n yet**: the calls to the renderer need its
key as a stored n8n credential, and the wiring belongs in the test copy of the proposal flow (plan step 6).

| File | What it decides |
|---|---|
| colour_result.js | What the deck build gets from the colour reading: the client's main colour when the reading is "high" confidence, nothing otherwise, and then the one line for the email |
| hex_reply.js | Whether a partner's reply holds a HEX code, reading only the new text of the reply |
| t_colours.js | offline test, 25 checks: `node n8n/colours/t_colours.js` |

## How it is meant to be wired

1. **Read the colour beside the research.** `POST /palette` with the client's website (renderer) -> colour_result.js.
2. **Build the deck.** When `brand` is set, it goes into the `/render` request and the deck is built in the client's
   colour. The email then says nothing about colours.
3. **Otherwise** the deck is in JML colours and the email carries `colour_note`: the deck was not personalised;
   reply with the client's main colour as a HEX code.
4. **A reply with a HEX code** (hex_reply.js): the flow takes the deck it sent in that thread and posts it to
   `POST /recolor?primary=<HEX>` (renderer). The same deck comes back repainted. No research runs again.
   Two different codes in one reply: the flow asks which one. A deck that is no longer in JML colours cannot be
   repainted from its file: the renderer says so (422).

Renderer side (in the repo root): `brand.py`, `/palette`, `/render` with `brand`, `/recolor`; tests in
`tests/test_brand.py` (36 checks).
