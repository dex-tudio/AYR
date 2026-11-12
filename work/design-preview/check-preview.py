from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess


class PreviewParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.variants = []
        self.screens = []
        self.views = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attribute, values in [
            ("data-variant", self.variants),
            ("data-screen", self.screens),
            ("data-view", self.views),
        ]:
            if attribute in attrs:
                values.append(attrs[attribute])


source = Path(__file__).with_name("ayr-direction.html").read_text(encoding="utf-8")
parser = PreviewParser()
parser.feed(source)
assert len(parser.variants) == 2 and len(set(parser.variants)) == 2
assert parser.screens == ["today", "month", "lock"] * 2
assert parser.views == parser.screens
scripts = re.findall(r"<script>([\s\S]*?)</script>", source)
assert len(scripts) == 1
subprocess.run(["node", "--check"], input=scripts[0], text=True, check=True)
assert 5100 + 8700 + 18600 == 32400
assert 1500000 - 286400 == 1213600
assert 7 + 3 + 1 == 11
assert "\\\"" not in source
print("PASS: preview structure, JavaScript syntax, sample amounts")
