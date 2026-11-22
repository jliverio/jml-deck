"""The page fetch of logos.py against a local server: a very long home page is cut, not refused; an image still is.
Run: python3 tests/test_logos_fetch.py"""
import http.server, os, sys, threading
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import brand, logos

BIG = b'<html><head><link rel="icon" href="/favicon.ico"></head><body>' + b'x' * 3000


class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(BIG)

    def log_message(self, *a):
        pass


srv = http.server.HTTPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = 'http://127.0.0.1:%d/' % srv.server_port
ok = 0
try:
    logos._fetch(url, 1000, 3)
    print('FAIL: a local address was fetched')
except Exception as e:
    ok += type(e).__name__ == 'PaletteError'            # the private-network guard still stands
brand._public = lambda u: None                          # for the test only: allow the local server
data, final, ctype = logos._fetch(url, 1000, 3, cut=True)
ok += (len(data) == 1000 and data.startswith(b'<html><head><link rel="icon"') and ctype == 'text/html')
try:
    logos._fetch(url, 1000, 3)
    print('FAIL: an oversized file was accepted without cut')
except ValueError:
    ok += 1
data, _, _ = logos._fetch(url, 10_000, 3)
ok += len(data) == len(BIG)
print(f'{ok}/4 passed')
sys.exit(0 if ok == 4 else 1)
