#!/usr/bin/env bash
set -euo pipefail
selected=$(python3 - <<'PY'
import re
from pathlib import Path
candidates = [(tuple(map(int, match.group(1).split('.'))), path) for path in Path('/Applications').glob('Xcode_*.app')
              if (match := re.fullmatch(r'Xcode_(\d+(?:\.\d+)*)\.app', path.name)) and int(match.group(1).split('.')[0]) >= 26]
if candidates:
    print(max(candidates)[1])
PY
)
[[ -n "$selected" ]] || { echo 'Xcode 26 or newer is required' >&2; exit 1; }
sudo xcode-select --switch "$selected/Contents/Developer"
xcodebuild -version
major=$(xcodebuild -version | awk '/^Xcode / {split($2, version, "."); print version[1]}')
test "$major" -ge 26
