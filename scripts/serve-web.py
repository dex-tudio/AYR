"""Serves a static directory for the web tests: python3 scripts/serve-web.py <port> <directory>. Standard library only."""
import functools
import http.server
import sys


class Server(http.server.ThreadingHTTPServer):
    # The default backlog of 5 makes the OS refuse connections when parallel tests open the app at once.
    request_queue_size = 128


handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=sys.argv[2])
Server(("127.0.0.1", int(sys.argv[1])), handler).serve_forever()
