# The Guild Hall's own little server, one per session that ran /guild.
#   python3 hall-server.py <dir> <first port>
# It serves the hall page and live.json from <dir> on 127.0.0.1 only, and hands each quest the
# page sends (POST /petition) and each shop order (POST /shop) to the session as one JSON line
# on stdout. The page carries a
# token minted here, so no other site can post quests; the Host check stops DNS rebinding.
import http.server
import json
import os
import secrets
import socketserver
import sys

root, first = sys.argv[1], int(sys.argv[2])
token = secrets.token_urlsafe(24)


class Hall(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=root, **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def local(self):
        port = self.server.server_address[1]
        # guildmaster.localhost is the hall's own name: browsers send every *.localhost to this machine.
        return self.headers.get('Host', '') in (f'127.0.0.1:{port}', f'localhost:{port}', f'guildmaster.localhost:{port}')

    def do_GET(self):
        if not self.local():
            return self.send_error(403)
        if self.path.split('?')[0] in ('/', '/index.html'):
            with open(os.path.join(root, 'index.html'), 'rb') as f:
                page = f.read().replace(b'__GUILD_TOKEN__', token.encode())
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(page)))
            self.end_headers()
            self.wfile.write(page)
            return
        if self.path.split('?')[0] != '/live.json':
            return self.send_error(404)
        super().do_GET()

    def do_POST(self):
        host = self.headers.get('Host', '')
        kind = {'/petition': 'petition', '/shop': 'shop'}.get(self.path)
        if not kind or not self.local() or self.headers.get('Origin') != f'http://{host}' or not secrets.compare_digest(self.headers.get('X-Guild-Token', ''), token):
            return self.send_error(403)
        size = min(int(self.headers.get('Content-Length') or 0), 100_000)
        try:
            body = json.loads(self.rfile.read(size) or b'{}')
        except ValueError:
            return self.send_error(400)
        print(json.dumps({kind: body}), flush=True)
        self.send_response(204)
        self.end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


for port in range(first, first + 20):
    try:
        server = Server(('127.0.0.1', port), Hall)
    except OSError:
        continue
    print(json.dumps({'ready': port}), flush=True)
    server.serve_forever()
sys.exit('no free port')
