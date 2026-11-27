#!/usr/bin/env bash
set -euo pipefail
# App Store Connect requires the iOS 27 SDK from April 2027; Xcode 27.2 ships it (GitHub xcode-27 runner).
# Swift 6.2 (Xcode 26.3) broke ExpoModulesJSI's pointer captures, so never fall back to an older toolchain.
selected=/Applications/Xcode_27.2.app/Contents/Developer
[[ -d "$selected" ]] || { echo 'Xcode 27.2 (27B52) is required; use the xcode-27 runner' >&2; exit 1; }
sudo xcode-select --switch "$selected"
version=$(xcodebuild -version)
printf '%s\n' "$version"
[[ "$version" == $'Xcode 27.2\nBuild version 27B52' ]] || { echo 'Unexpected Xcode version or build' >&2; exit 1; }
