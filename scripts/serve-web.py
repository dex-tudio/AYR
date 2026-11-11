"""Serves a static directory for the web tests: python3 scripts/serve-web.py <port> <directory>. Standard library only.
A path without a file extension that matches no file gets index.html (the app routes it, like a single-page host);
a missing file with an extension (an asset) is still a 404."""
import functools
import http.server
import os
import sys
import urllib.parse


class Server(http.server.ThreadingHTTPServer):
    # The default backlog of 5 makes the OS refuse connections when parallel tests open the app at once.
    request_queue_size = 128


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = super().translate_path(path)
        if not os.path.exists(translated) and not os.path.splitext(urllib.parse.urlsplit(path).path)[1]:
            return os.path.join(self.directory, "index.html")
        return translated


handler = functools.partial(Handler, directory=sys.argv[2])
Server(("127.0.0.1", int(sys.argv[1])), handler).serve_forever()
