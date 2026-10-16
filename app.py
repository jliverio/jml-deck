"""
JML AI Analyst - deck render service.

POST /render   header X-API-Key: <secret>
  Variable payload (template 1.2 by default):
    {"values": {variable: text}, "rules": [table rows], "meta": {"filename": "..."},
     "workplan": compiled Phase Architect plan (optional; draws the timeline, deliverables, steering slides),
     "template": "1.1", "1.2" (default) or "1.3" (1.2 + Approach section and work-plan slides)}
    -> 200 .pptx, header X-Render-Warnings (JSON list, may be empty)
    -> 422 {"error": ...} when the template, the table and the values disagree
  Legacy payload ({"cover": ..., "context": ...}) -> previous renderer.
GET  /health   -> 200 {"ok": true, ...}
"""
import json
import os

from flask import Flask, Response, jsonify, request

import varfill

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(HERE, "template.pptx")):
    from templatefill import build_deck as legacy_build
    LEGACY = "template"
else:
    from deckgen import build_deck as legacy_build
    LEGACY = "generic"

app = Flask(__name__)
API_KEY = os.environ.get("JML_API_KEY", "")
MAX_BYTES = 1_000_000
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@app.get("/health")
def health():
    return jsonify(ok=True, service="jml-deck", auth=bool(API_KEY),
                   renderer="variables-1.2", legacy=LEGACY,
                   template=os.path.exists(varfill.TEMPLATE))


@app.post("/render")
def render():
    if API_KEY and request.headers.get("X-API-Key", "") != API_KEY:
        return jsonify(error="unauthorized"), 401
    raw = request.get_data(cache=True)
    if len(raw) > MAX_BYTES:
        return jsonify(error="payload too large"), 413
    try:
        data = json.loads(raw) if raw else {}
    except Exception as e:
        return jsonify(error=f"invalid JSON: {e}"), 400

    fname = ((data.get("meta") or {}).get("filename")) or "proposal_draft.pptx"
    warnings = []
    try:
        if "values" in data:
            pptx, warnings = varfill.build_deck(data.get("values") or {}, data.get("rules"),
                                                workplan=data.get("workplan"),
                                                version=data.get("template"))
        else:
            pptx = legacy_build(data)
    except (varfill.TemplateCapacityError, varfill.TemplateRulesError,
            varfill.TemplateFormatError) as e:
        return jsonify(error=str(e), kind=type(e).__name__), 422
    except Exception as e:
        return jsonify(error=f"render failed: {e}"), 500

    return Response(pptx, mimetype=PPTX, headers={
        "Content-Disposition": f'attachment; filename="{fname}"',
        "X-Render-Warnings": json.dumps(warnings[:20]),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
