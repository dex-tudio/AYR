#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# -le 1 ]] || { echo 'Usage: prepare-ios.sh [XcodeGen spec]' >&2; exit 1; }
xcodegen generate --spec "${1:-project.yml}"
cocoapods_version=$(pod _1.17.0_ --version)
[[ "$cocoapods_version" == 1.17.0 ]] || { echo 'CocoaPods 1.17.0 is required' >&2; exit 1; }
echo "CocoaPods $cocoapods_version"
if [[ -f Podfile.lock ]]; then
  pod _1.17.0_ install --deployment
else
  if [[ "${AYR_BOOTSTRAP_PODS:-0}" != 1 ]]; then
    echo 'Podfile.lock is required. Resolve it once with AYR_BOOTSTRAP_PODS=1, review and commit it, then rerun.' >&2
    exit 1
  fi
  pod _1.17.0_ install
fi
