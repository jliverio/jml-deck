"""A company's logo, read from its home page (22 Nov).

    find(url)   -> (PNG bytes or None, note)      one site
    fetch_all({"client": url, "competitor_01": url, ...}) -> ({key: base64 PNG}, {key: note})   side by side

Where it looks, best first:
  1. an image in the page's header, navigation or home link whose address, alt text or class says "logo";
  2. an image anywhere whose address or alt text says "logo" and names the site (so a wall of customers' logos
     is not mistaken for the company's own);
  3. a logo drawn in the page itself (inline SVG) in the header or home link;
  4. the site's touch icon, then its other icons (the small square mark a phone shows for the site).
A candidate is used only if it reads as a picture, is at least 48 px, and would show on white: a white logo
made for a dark header is skipped and the next candidate tried (research_slides._load_logo decides, the same
test the deck applies). No browser: a site that draws its header with scripts gives only its icons.
Standard library, Pillow and resvg-py (SVG to PNG; no system libraries).
"""
import base64
import io
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

import brand
import research_slides

MAX_HTML = 1_500_000
MAX_IMAGE = 2_000_000
MAX_SVG = 400_000
OUT_W, OUT_H = 640, 320          # the deck shows a logo at most 2 in wide; this is sharp enough and small to send
SITE_BUDGET = 9.0                # seconds for one site
HINT = re.compile(r"logo|brand|wordmark", re.I)
LIGHT = re.compile(r"white|light|inverse|inverted|negative|reverse|branco|blanc", re.I)
DARK = re.compile(r"dark|black|colou?r|primary|default", re.I)
NOT_LOGO = re.compile(r"sprite|icon-|/icons?/|arrow|menu|search|close|flag|avatar|badge|app-?store|google-?play|"
                      r"payment|visa|mastercard|paypal|partner|client|customer|testimonial|award|press", re.I)


class _Safe(urllib.request.HTTPRedirectHandler):
    """Every address a redirect leads to is checked like the first one (never inside a private network)."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        brand._public(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_Safe)


def _fetch(url, limit, timeout, cut=False):
    """-> (bytes, final address, content type). Only http and https, only public addresses.
    More than `limit` bytes is refused, except with cut=True: then the first `limit` bytes are returned
    (a home page: the logo sits in the header, at the top, so a very long page is still usable)."""
    if urllib.parse.urlparse(url).scheme not in ("http", "https"):
        raise ValueError("not a web address")
    brand._public(url)
    req = urllib.request.Request(url, headers={"User-Agent": brand.UA, "Accept": "*/*", "Accept-Encoding": "identity"})
    with _opener.open(req, timeout=timeout) as r:
        data = r.read(limit + 1)
        if len(data) > limit:
            if not cut:
                raise ValueError("too large")
            data = data[:limit]
        return data, r.geturl(), (r.headers.get("Content-Type") or "").lower()


class _Page(HTMLParser):
    """Collects logo candidates in page order: <img>, inline <svg> and <link rel=icon>."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []            # open tags that give context: header, nav, a (home link or not)
        self.cands = []            # dicts: kind, src / svg, where, hint text, order
        self.svg = None            # (depth, parts, where, hint) while inside an inline svg
        self.n = 0
        self.base = None

    def _where(self):
        tags = [t for t, _ in self.stack]
        home = any(t == "a" and h for t, h in self.stack)
        return "home" if home else ("header" if ("header" in tags or "nav" in tags) else "body")

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if self.svg is not None:
            self.svg[1].append(self.get_starttag_text())
            if tag == "svg":
                self.svg[0] += 1
            return
        self.n += 1
        if tag == "base" and a.get("href") and not self.base:
            self.base = a["href"]
        elif tag in ("header", "nav"):
            self.stack.append((tag, False))
        elif tag == "a":
            href = a.get("href", "").strip()
            path = urllib.parse.urlparse(href).path if href else "x"
            home = bool(href) and not href.startswith(("#", "mailto:", "tel:", "javascript:")) and path in ("", "/") \
                and not urllib.parse.urlparse(href).query
            hint = " ".join(a.get(k, "") for k in ("class", "id", "aria-label", "title"))
            self.stack.append(("a", home or bool(HINT.search(hint))))
        elif tag == "img":
            src = a.get("src") or a.get("data-src") or a.get("data-lazy-src") or ""
            if not src and a.get("srcset"):
                src = a["srcset"].split(",")[0].strip().split(" ")[0]
            if src and not src.startswith("data:image/gif"):
                self.cands.append({"kind": "img", "src": src, "where": self._where(), "order": self.n,
                                   "hint": " ".join([src, a.get("alt", ""), a.get("class", ""), a.get("id", "")])})
        elif tag == "svg":
            hint = " ".join(a.get(k, "") for k in ("class", "id", "aria-label", "title", "data-name"))
            self.svg = [1, [self.get_starttag_text()], self._where(), hint]
        elif tag == "link":
            rel = a.get("rel", "").lower()
            if "icon" in rel and a.get("href"):
                size = 0
                m = re.search(r"(\d+)x(\d+)", a.get("sizes", ""))
                if m:
                    size = int(m.group(1))
                self.cands.append({"kind": "touch" if "apple-touch" in rel else "icon", "src": a["href"], "where": "head",
                                   "order": self.n, "hint": a.get("type", ""), "size": size})

    def handle_startendtag(self, tag, attrs):
        if self.svg is not None:
            self.svg[1].append(self.get_starttag_text())
            return
        self.handle_starttag(tag, attrs)
        if tag in ("header", "nav", "a") and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if self.svg is not None:
            self.svg[1].append(f"</{tag}>")
            if tag == "svg":
                self.svg[0] -= 1
                if self.svg[0] == 0:
                    depth, parts, where, hint = self.svg
                    self.svg = None
                    markup = "".join(parts)
                    if len(markup) <= MAX_SVG:
                        self.cands.append({"kind": "svg", "svg": markup, "where": where, "order": self.n, "hint": hint})
            return
        if tag in ("header", "nav", "a"):
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    del self.stack[i:]
                    break

    def handle_data(self, data):
        if self.svg is not None:
            self.svg[1].append(data.replace("&", "&amp;").replace("<", "&lt;"))


def _token(url):
    """The site's own name as its address spells it: equalfood for www.equalfood.co."""
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    parts = [p for p in host.split(".") if p not in ("www", "app", "shop", "store", "en", "pt")]
    if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "net") and len(parts[-1]) == 2:
        parts = parts[:-1]
    return re.sub(r"[^a-z0-9]", "", parts[-2] if len(parts) >= 2 else (parts[0] if parts else ""))


def _score(c, token):
    hint = c["hint"]
    flat = re.sub(r"[^a-z0-9]", "", hint.lower())
    named = len(token) >= 3 and token in flat
    says = bool(HINT.search(hint))
    if c["kind"] == "img":
        if NOT_LOGO.search(c["src"]) and not named:
            return 0
        if c["where"] in ("home", "header") and (says or named):
            s = 100 if c["where"] == "home" else 92
        elif c["where"] == "home":
            s = 70                                   # the picture inside the link to the home page
        elif says and named:
            s = 80
        else:
            return 0
    elif c["kind"] == "svg":
        if c["where"] == "home":
            s = 88 if (says or named) else 66
        elif c["where"] == "header" and (says or named):
            s = 84
        else:
            return 0
        if "<use" in c["svg"] and "<path" not in c["svg"] and "<polygon" not in c["svg"]:
            return 0                                 # drawn from a sprite elsewhere on the page: nothing to render
    elif c["kind"] == "touch":
        s = 50 + min(c.get("size", 0), 512) / 100.0
    else:
        s = (45 if "svg" in hint else (40 if c.get("size", 0) >= 96 else 20)) + min(c.get("size", 0), 512) / 100.0
    if c["kind"] in ("img", "svg"):
        if LIGHT.search(hint):
            s -= 30
        elif DARK.search(hint):
            s += 3
        s -= min(c["order"], 4000) / 1000.0          # earlier on the page wins among equals
    return s


def _clean_svg(markup):
    """An SVG may point at other files; only what it draws itself is rendered."""
    markup = re.sub(r"<script\b.*?</script>", "", markup, flags=re.S | re.I)
    markup = re.sub(r"<foreignObject\b.*?</foreignObject>", "", markup, flags=re.S | re.I)
    markup = re.sub(r"\s(?:xlink:)?href\s*=\s*(\"(?!#|data:)[^\"]*\"|'(?!#|data:)[^']*')", "", markup, flags=re.I)
    if "xmlns=" not in markup.split(">", 1)[0]:
        markup = markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    if "xlink:" in markup and "xmlns:xlink" not in markup:
        markup = markup.replace("<svg", '<svg xmlns:xlink="http://www.w3.org/1999/xlink"', 1)
    return markup


def _svg_png(markup):
    import resvg_py
    markup = _clean_svg(markup)
    # currentColor (the text colour of the page) is black on a white slide
    return bytes(resvg_py.svg_to_bytes(svg_string=markup, width=OUT_W, style_sheet="svg{color:#111111}"))


def _to_png(raw, ctype=""):
    """Any picture the site serves -> PNG bytes, at most OUT_W x OUT_H."""
    from PIL import Image
    head = raw[:400].lstrip().lower()
    if "svg" in ctype or head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in raw[:2000].lower()):
        if len(raw) > MAX_SVG:
            raise ValueError("SVG too large")
        raw = _svg_png(raw.decode("utf8", "ignore"))
    im = Image.open(io.BytesIO(raw))
    if getattr(im, "format", "") == "ICO":
        sizes = sorted(im.info.get("sizes") or [im.size])
        im.size = sizes[-1]                           # the largest picture inside the .ico file
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    im = im.convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)
    k = min(OUT_W / im.size[0], OUT_H / im.size[1], 1.0)
    if k < 1.0:
        im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def find(url, budget=SITE_BUDGET):
    """-> (PNG bytes or None, note). Never raises."""
    t0 = time.time()
    left = lambda: max(budget - (time.time() - t0), 0.5)
    url = (url or "").strip()
    if not url:
        return None, "no address"
    if not re.match(r"https?://", url, re.I):
        url = "https://" + url
    try:
        raw, final, _ = _fetch(url, MAX_HTML, min(left(), 6.0), cut=True)
    except Exception as e:
        return None, f"the home page could not be read ({type(e).__name__})"
    page = _Page()
    try:
        page.feed(raw.decode("utf8", "ignore"))
    except Exception:
        pass                                          # a broken page still gives what was read before the break
    base = urllib.parse.urljoin(final, page.base) if page.base else final
    token = _token(final)
    cands = [dict(c, score=_score(c, token)) for c in page.cands]
    if not any(c["kind"] in ("touch", "icon") for c in cands):
        cands.append({"kind": "touch", "src": "/apple-touch-icon.png", "where": "head", "order": 0, "hint": "", "score": 30})
        cands.append({"kind": "icon", "src": "/favicon.ico", "where": "head", "order": 0, "hint": "", "score": 10})
    cands = sorted([c for c in cands if c["score"] > 0], key=lambda c: -c["score"])
    tried, seen = [], set()
    for c in cands[:8]:
        if time.time() - t0 > budget:
            tried.append("out of time")
            break
        label = {"img": "image", "svg": "drawing in the page", "touch": "touch icon", "icon": "site icon"}[c["kind"]] \
            + ("" if c["kind"] in ("touch", "icon") else {"home": " in the home link", "header": " in the header", "body": ""}[c["where"]])
        try:
            if c["kind"] == "svg":
                png = _to_png(_svg_png(c["svg"]))
            else:
                src = urllib.parse.urljoin(base, c["src"])
                if src in seen:
                    continue
                seen.add(src)
                if src.startswith("data:"):
                    head, _, body = src.partition(",")
                    data = base64.b64decode(body) if ";base64" in head else urllib.parse.unquote_to_bytes(body)
                    png = _to_png(data, head)
                else:
                    data, _, ctype = _fetch(src, MAX_IMAGE, min(left(), 4.0))
                    png = _to_png(data, ctype)
        except Exception as e:
            tried.append(f"{label}: unreadable ({type(e).__name__})")
            continue
        warn = []
        if research_slides._load_logo(base64.b64encode(png).decode(), warn, "x") is None:
            why = warn[0].split("logo of x ", 1)[-1].replace("; left out", "") if warn else "not usable"
            tried.append(f"{label}: {why}")
            continue
        return png, f"found: {label}"
    return None, "no usable logo" + (" (" + "; ".join(tried[:4]) + ")" if tried else " on the home page")


def fetch_all(sites, budget=SITE_BUDGET):
    """{key: address} -> ({key: base64 PNG}, {key: note}); the sites are read side by side."""
    keys = [k for k in list(sites or {})[:6] if str(sites[k] or "").strip()]
    logos, notes = {}, {}
    if not keys:
        return logos, notes
    with ThreadPoolExecutor(max_workers=len(keys)) as pool:
        for k, (png, note) in zip(keys, pool.map(lambda key: find(str(sites[key]), budget), keys)):
            notes[k] = note
            if png:
                logos[k] = base64.b64encode(png).decode()
    return logos, notes
