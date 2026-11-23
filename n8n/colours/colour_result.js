// What the deck build gets from the colour reading (renderer, POST /palette with the client's website).
// The colour is handed on only when the reading is "high" confidence (the renderer says so in "apply").
// Otherwise the deck stays in JML colours and the email carries one line asking for the colour.
// Only the main colour is handed on: the gate yellow stays JML's.
const pal = ($input.first() && $input.first().json) || {};
const hex = String(pal.primary || '').replace('#', '').toUpperCase();
const applied = pal.apply === true && /^[0-9A-F]{6}$/.test(hex);
const failed = !!pal.error;
const LINE = "This deck is in JML colours: the client's colour could not be read from its website with enough confidence. Reply with the client's main colour as a HEX code (for example #E60000) and the same deck comes back in that colour.";
return [{ json: {
  brand: applied ? { primary: hex } : null,
  colour_applied: applied,
  colour_confidence: failed ? 'not read' : String(pal.confidence || 'none'),
  colour_note: applied ? '' : LINE,
  colour_detail: failed ? String(pal.error.message || pal.error).slice(0, 200) : String(pal.note || '').slice(0, 200),
} }];
