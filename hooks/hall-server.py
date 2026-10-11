# The Guild Hall's server: one per machine, shared by every session, owned by none.
#   python3 hall-server.py <dir> <first port> <version>
# It binds the first free port from <first port>, prints {"ready": port}, then leaves for the
# background, so it outlives the session that started it. It serves the hall page and the
# live.json the sessions keep fresh in <dir>, on 127.0.0.1 only, and files each quest the
# page sends (POST /petition) in <dir>/inbox/<session>/ and each shop order (POST /shop) in
# <dir>/shop/, for the sessions to pick up. It notes itself in <dir>/server.json, and goes
# when no session has written live.json for half an hour. The page carries a token minted
# here, so no other site can post quests; the Host check stops DNS rebinding.
import http.server
import json
import os
import re
import secrets
import signal
import socketserver
import sys
import threading
import time

root, first, version = sys.argv[1], int(sys.argv[2]), sys.argv[3]
token = secrets.token_urlsafe(24)
IDLE_S = 30 * 60
SESSION_ID = re.compile(r'^[A-Za-z0-9_-]{1,100}$')


def drop(path, body):
    """Write a file whole: a session never reads one half written."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f'{path}.{secrets.token_hex(4)}.tmp'
    with open(tmp, 'w') as f:
        json.dump(body, f)
    os.replace(tmp, path)


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
        name = f'{time.time_ns()}-{secrets.token_hex(3)}.json'
        if kind == 'petition':
            realm = body.get('realm') if isinstance(body, dict) else None
            if not isinstance(realm, str) or not SESSION_ID.match(realm):
                return self.send_error(400)
            drop(os.path.join(root, 'inbox', realm, name), body)
        else:
            drop(os.path.join(root, 'shop', name), body)
        self.send_response(204)
        self.end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def idle():
    # Gone once no session has written live.json for a while: the last of them has ended.
    started = time.time()
    while True:
        time.sleep(60)
        try:
            last = os.path.getmtime(os.path.join(root, 'live.json'))
        except OSError:
            last = started
        if time.time() - max(last, started) > IDLE_S:
            leave()
            os._exit(0)


def leave():
    try:
        with open(os.path.join(root, 'server.json')) as f:
            if json.load(f).get('pid') == os.getpid():
                os.remove(os.path.join(root, 'server.json'))
    except (OSError, ValueError):
        pass


server = None
for port in range(first, first + 20):
    try:
        server = Server(('127.0.0.1', port), Hall)
        break
    except OSError:
        continue
if server is None:
    sys.exit('no free port')

# Into the background: the session's call returns once this process has said where it is.
if os.fork() > 0:
    print(json.dumps({'ready': server.server_address[1]}), flush=True)
    os._exit(0)
os.setsid()
devnull = os.open(os.devnull, os.O_RDWR)
for fd in (0, 1, 2):
    os.dup2(devnull, fd)
drop(os.path.join(root, 'server.json'), {'pid': os.getpid(), 'port': server.server_address[1], 'version': version})
threading.Thread(target=idle, daemon=True).start()
# Made way for a newer build: take server.json along.
signal.signal(signal.SIGTERM, lambda *_: (leave(), os._exit(0)))
try:
    server.serve_forever()
finally:
    leave()
