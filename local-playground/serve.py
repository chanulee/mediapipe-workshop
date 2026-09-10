from __future__ import annotations

import contextlib
import http.server
import os
from pathlib import Path
import socketserver
import threading
import webbrowser


HOST = "127.0.0.1"
PORT = 8000


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def make_server() -> Server:
    handler = http.server.SimpleHTTPRequestHandler
    try:
        return Server((HOST, PORT), handler)
    except OSError:
        return Server((HOST, 0), handler)


def main() -> None:
    os.chdir(Path(__file__).resolve().parent)
    server = make_server()
    port = server.server_address[1]
    url = f"http://{HOST}:{port}/kids/"
    print(f"\nMediaPipe Kids Playground: {url}")
    print("종료: Ctrl+C\n")
    threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    with contextlib.suppress(KeyboardInterrupt):
        server.serve_forever()
    server.server_close()


if __name__ == "__main__":
    main()

