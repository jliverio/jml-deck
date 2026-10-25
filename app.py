"""
JML AI Analyst - deck render service.

POST /render   header X-API-Key: <secret>
  Variable payload (template 1.2 by default):
    {"values": {variable: text}, "rules": [table rows], "meta": {"filename": "..."},
     "workplan": compiled Phase Architect plan (optional; draws the timeline, deliverables, steering slides),
     "template": "1.1", "1.2" (default), "1.3" (1.2 + Approach section and work-plan slides)
               or "1.4" (1.3 + situation slide, approach overview)
               or "1.5" (1.4 filled, then the S3 layout: no dividers, summary after the situation,
                         one-page roadmap, assumptions slide, "[Firm to complete] Fees" slide),
     "s3": {"assumptions": [{"id", "text", "if_wrong"}], "deadline_weeks": n} (template 1.5 only)}
    -> 200 .pptx, header X-Render-Warnings (JSON list, may be empty)
    -> 422 {"error": ...} when the template, the table and the values disagree
  Legacy payload ({"cover": ..., "context": ...}) -> previous renderer.
POST /extract  header X-API-Key: <secret>; body: the file (raw, with its Content-Type), name in ?name= or
               X-File-Name; or multipart form field "file"; or JSON {"files": [{"name", "mime", "b64"}]} (up to 5)
               -> {"results": [one object per file, as below]}
    -> 200 {"name", "kind": "pdf"|"docx"|"unsupported", "pages_total", "pages_read", "chars", "truncated",
            "text", "note"}: the first 10 PDF pages or about 10 Word pages (extract.py)
GET  /health   -> 200 {"ok": true, ...}
"""
import json
import os

from flask import Flask, Response, jsonify, request

import extract as attach
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
MAX_FILE_BYTES = 15_000_000   # attachments read by /extract (Gmail caps a message at 25 MB)
MAX_JSON_BYTES = 45_000_000   # /extract with several base64 files in one JSON body
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@app.get("/health")
def health():
    return jsonify(ok=True, service="jml-deck", auth=bool(API_KEY),
                   renderer="variables-1.2", legacy=LEGACY,
                   template=os.path.exists(varfill.TEMPLATE),
                   templates=sorted(varfill.TEMPLATES), extract=True)


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
                                                version=data.get("template"),
                                                s3=data.get("s3"))
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


@app.post("/extract")
def extract_text():
    """Email plan E6 (Oct 25): text of a PDF or Word attachment for the intake workflow."""
    if API_KEY and request.headers.get("X-API-Key", "") != API_KEY:
        return jsonify(error="unauthorized"), 401
    if request.content_length and request.content_length > (MAX_JSON_BYTES if request.is_json else MAX_FILE_BYTES):
        return jsonify(error="file too large"), 413
    if request.is_json:   # the intake sends every attachment of one email at once: {"files": [{name, mime, b64}]}
        import base64
        try:
            files = (request.get_json(silent=True) or {}).get("files") or []
            results = []
            for x in files[:5]:
                data = base64.b64decode(x.get("b64") or "")
                results.append(attach.extract(data[:MAX_FILE_BYTES], x.get("name") or "", x.get("mime") or "")
                               if len(data) <= MAX_FILE_BYTES else
                               dict(name=x.get("name") or "", kind="unsupported", text="", note="The file is over 15 MB; nothing was read."))
        except Exception as e:
            return jsonify(error=f"invalid files: {type(e).__name__}"), 400
        return jsonify(results=results)
    f = request.files.get("file")
    if f is not None:
        data, name, mime = f.read(MAX_FILE_BYTES + 1), f.filename or "", f.mimetype or ""
    else:
        data = request.get_data(cache=False)
        name = request.args.get("name") or request.headers.get("X-File-Name", "")
        mime = request.content_type or ""
    if len(data) > MAX_FILE_BYTES:
        return jsonify(error="file too large"), 413
    return jsonify(attach.extract(data, name, mime))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
