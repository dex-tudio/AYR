#!/usr/bin/env bash
set -euo pipefail
# Use Swift 6.3 to avoid ExpoModulesJSI's pointer-capture errors on Swift 6.2.
selected=/Applications/Xcode_26.4.1.app/Contents/Developer
[[ -d "$selected" ]] || { echo 'Xcode 26.4.1 (17E202) is required; use the macos-26 runner' >&2; exit 1; }
sudo xcode-select --switch "$selected"
version=$(xcodebuild -version)
printf '%s\n' "$version"
[[ "$version" == $'Xcode 26.4.1\nBuild version 17E202' ]] || { echo 'Unexpected Xcode version or build' >&2; exit 1; }
