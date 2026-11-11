#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# -le 1 ]] || { echo 'Usage: prepare-ios.sh [XcodeGen spec]' >&2; exit 1; }
xcodegen generate --spec "${1:-project.yml}"
pod --version
if [[ -f Podfile.lock ]]; then
  pod install --deployment
else
  pod install
fi
