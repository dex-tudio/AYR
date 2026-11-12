#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# -le 1 ]] || { echo 'Usage: prepare-ios.sh [XcodeGen spec]' >&2; exit 1; }
xcodegen generate --spec "${1:-project.yml}"
pod --version
if [[ -f Podfile.lock ]]; then
  pod install --deployment
else
  if [[ "${AYR_BOOTSTRAP_PODS:-0}" != 1 ]]; then
    echo 'Podfile.lock is required. Resolve it once with AYR_BOOTSTRAP_PODS=1, review and commit it, then rerun.' >&2
    exit 1
  fi
  pod install
fi
