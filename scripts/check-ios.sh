#!/usr/bin/env bash
set -euo pipefail
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
swiftc -emit-library -emit-module -module-name AYRCore Core/Sources/AYRCore/*.swift -emit-module-path "$scratch/AYRCore.swiftmodule" -o "$scratch/libAYRCore.so"
swiftc -I "$scratch" -L "$scratch" -lAYRCore iOS/Shared/SpendingPresentation.swift iOS/Tests/Presentation/main.swift -o "$scratch/presentation-checks"
LD_LIBRARY_PATH="$scratch${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" "$scratch/presentation-checks"
swiftc -I "$scratch" -L "$scratch" -lAYRCore iOS/App/LedgerBridgeState.swift iOS/Tests/Bridge/main.swift -o "$scratch/bridge-checks"
LD_LIBRARY_PATH="$scratch${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" "$scratch/bridge-checks"
for source in iOS/App/*.swift iOS/Widgets/*.swift iOS/Shared/*.swift; do
  swiftc -frontend -parse "$source"
done
echo 'iOS Swift syntax checks passed (SDK type checking requires Xcode)'
