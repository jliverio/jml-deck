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
               or "1.5.4" (José's own file as the template, with the two market research slides),
     "s3": {"assumptions": [{"id", "text", "if_wrong"}], "deadline_weeks": n} (templates 1.5 and 1.5.4),
     "logos": {"competitor_01": <base64 PNG or JPEG>, ..., "client": <base64>} (template 1.5.4; optional:
               competitor logos in the comparison headers, the client's logo in the cover's logo slot)}
    -> 200 .pptx, header X-Render-Warnings (JSON list, may be empty)
    -> 422 {"error": ...} when the template, the table and the values disagree
  Legacy payload ({"cover": ..., "context": ...}) -> previous renderer.
POST /extract  header X-API-Key: <secret>; body: the file (raw, with its Content-Type), name in ?name= or
               X-File-Name; or multipart form field "file"; or JSON {"files": [{"name", "mime", "b64"}]} (up to 5)
               -> {"results": [one object per file, as below]}
    -> 200 {"name", "kind": "pdf"|"docx"|"unsupported", "pages_total", "pages_read", "chars", "truncated",
            "text", "note"}: the first 10 PDF pages or about 10 Word pages (extract.py)
POST /fit      header X-API-Key: <secret>; same body as /render, template 1.5.4 -> whether the text of the two
               market research slides fits its boxes, box by box (fit.py); nothing is trimmed
POST /logos    header X-API-Key: <secret>; body {"sites": {"client": url, "competitor_01": url, ...}} -> the
               logos read from those home pages, as base64 PNG by key, with a note per site (logos.py)
POST /palette  header X-API-Key: <secret>; body {"url": ...} -> the site's brand colours (brand.py, trial)
GET  /health   -> 200 {"ok": true, ...}
"""
import json
import os
import re

from flask import Flask, Response, jsonify, request

import brand
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
MAX_BYTES = 2_000_000      # 22 Nov: room for up to four competitor logos (base64) in the payload
MAX_FILE_BYTES = 15_000_000   # attachments read by /extract (Gmail caps a message at 25 MB)
MAX_JSON_BYTES = 45_000_000   # /extract with several base64 files in one JSON body
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@app.get("/health")
def health():
    return jsonify(ok=True, service="jml-deck", auth=bool(API_KEY),
                   renderer="variables-1.2", legacy=LEGACY,
                   template=os.path.exists(varfill.TEMPLATE),
                   templates=sorted(varfill.TEMPLATES), extract=True, fit=_fit_ready(), logos=_logos_ready(),
                   approach_panel=_panel_ready())


_PANEL = []


def _panel_ready():
    """Template 1.5.4 keeps the "Main Deliverables" panel on its approach slide (23 Nov) and the renderer draws
    the phases beside it. True when both the template file and the code of this deploy have it. Worked out once:
    it opens the template file."""
    if not _PANEL:
        try:
            import workplan
            prs = varfill._load_template(varfill.TEMPLATES["1.5.4"])
            _PANEL.append(hasattr(workplan, "_panel") and any(workplan._panel(s) is not None for s in prs.slides))
        except Exception:
            _PANEL.append(False)
    return _PANEL[0]


def _logos_ready():
    """Reading logos needs resvg-py for the SVG ones (requirements.txt)."""
    try:
        import logos
        return len(logos._svg_png('<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>')) > 0
    except Exception:
        return False


def _fit_ready():
    """The fit check needs its four font files (assets/fonts); say so here rather than on the first /fit."""
    try:
        import fit
        return all(fit.width("Hamburg", 12, b, i) > 0 for b in (False, True) for i in (False, True))
    except Exception:
        return False


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
                                                s3=data.get("s3"), logos=data.get("logos"))
            # Oct 26 (trial): {"brand": {"primary": "C8102E", "accent": "FFB81C"}} repaints the deck in the
            # client's colours (brand.py); without it the deck is byte-identical to before.
            b = data.get("brand") or {}
            if b.get("primary") and re.fullmatch(r"#?[0-9A-Fa-f]{6}", str(b["primary"])):
                acc = b.get("accent") if re.fullmatch(r"#?[0-9A-Fa-f]{6}", str(b.get("accent") or "")) else None
                pptx, _ = brand.recolor_pptx(pptx, str(b["primary"]), acc)
                warnings.append(f"recoloured to the client's palette ({str(b['primary']).lstrip('#').upper()})")
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


@app.post("/fit")
def fit_check():
    """22 Nov: does the text of the two market research slides fit its boxes? Same body as /render (values,
    rules, template, logos); nothing is built for download and nothing is trimmed.
    -> {"fits": bool, "boxes": [{"box", "kind", "variables", "lines", "room_lines", "over", "over_by_lines"}],
        "over": [the boxes that do not fit], "warnings": [...]}"""
    if API_KEY and request.headers.get("X-API-Key", "") != API_KEY:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    version = str(data.get("template") or "1.5.4")
    if version not in varfill.FILE_LAYOUT:
        return jsonify(error=f"/fit works on template 1.5.4, not {version}"), 422
    report = {}
    try:
        _, warnings = varfill.build_deck(data.get("values") or {}, data.get("rules"), version=version,
                                         logos=data.get("logos"), fit_report=report, last_resort=False)
    except (varfill.TemplateCapacityError, varfill.TemplateRulesError, varfill.TemplateFormatError) as e:
        return jsonify(error=str(e), kind=type(e).__name__), 422
    except Exception as e:
        return jsonify(error=f"fit check failed: {e}"), 500
    boxes = report.get("boxes") or []
    return jsonify(fits=not any(b["over"] for b in boxes), boxes=boxes, over=[b for b in boxes if b["over"]],
                   warnings=warnings[:20])


@app.post("/logos")
def logos_of_sites():
    """22 Nov: the logos of the client and of the competitors, read from their home pages (logos.py).
    Body {"sites": {"client": "https://client.com", "competitor_01": "https://...", ...}} (up to six)
    -> {"logos": {key: base64 PNG}, "notes": {key: what was found or why nothing was}}. The logos go into
    /render as "logos"; a site with no usable logo is simply absent and the deck shows the name alone."""
    if API_KEY and request.headers.get("X-API-Key", "") != API_KEY:
        return jsonify(error="unauthorized"), 401
    sites = (request.get_json(silent=True) or {}).get("sites")
    if not isinstance(sites, dict) or not sites:
        return jsonify(error="no sites"), 400
    try:
        import logos
        found, notes = logos.fetch_all({str(k): str(v or "") for k, v in sites.items()})
    except Exception as e:
        return jsonify(error=f"{type(e).__name__}: {e}"[:300]), 502
    return jsonify(logos=found, notes=notes)


@app.post("/palette")
def palette():
    """Oct 26 (trial): a website's brand colours, read from its home page and style sheets (brand.py).
    Body {"url": "https://client.com"} -> {"primary", "secondary", "theme_color", "confidence", "top", "sources"}."""
    if API_KEY and request.headers.get("X-API-Key", "") != API_KEY:
        return jsonify(error="unauthorized"), 401
    url = str((request.get_json(silent=True) or {}).get("url") or "").strip()
    if not url:
        return jsonify(error="no url"), 400
    try:
        return jsonify(brand.extract_palette(url))
    except brand.PaletteError as e:
        return jsonify(error=str(e)), 422
    except Exception as e:
        return jsonify(error=f"{type(e).__name__}: {e}"[:300]), 502


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
