"""
JML AI Analyst — deck render service.

POST /render   body = deck JSON (see CONTRACT.md) ; header X-API-Key: <secret>
               -> 200 with the .pptx as binary (application/vnd...presentation)
GET  /health   -> 200 {"ok": true}

Auth: if env JML_API_KEY is set, every /render must send a matching X-API-Key.
Run locally:  JML_API_KEY=changeme python app.py   (listens on $PORT or 8080)
"""
import os
import json
from flask import Flask, request, jsonify, Response

# Prefer the template-based renderer; fall back to the generic one only if the
# bundled template didn't ship, so the loop never hard-fails on a bad deploy.
_HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(_HERE, "template.pptx")):
    from templatefill import build_deck
    RENDERER = "template"
else:
    from deckgen import build_deck
    RENDERER = "generic"

app = Flask(__name__)
API_KEY = os.environ.get("JML_API_KEY", "")
MAX_BYTES = 1_000_000  # reject absurd payloads


@app.get("/health")
def health():
    return jsonify(ok=True, service="jml-deck", auth=bool(API_KEY), renderer=RENDERER)


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
    try:
        pptx = build_deck(data)
    except Exception as e:
        return jsonify(error=f"render failed: {e}"), 500
    fname = (data.get("meta", {}) or {}).get("filename", "proposal_draft.pptx")
    return Response(
        pptx,
        mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)
