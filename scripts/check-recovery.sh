#!/usr/bin/env bash
set -euo pipefail
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
swiftc -emit-library -emit-module -module-name AYRCore Core/Sources/AYRCore/*.swift -emit-module-path "$scratch/AYRCore.swiftmodule" -o "$scratch/libAYRCore.so"
swiftc -I "$scratch" -L "$scratch" -lAYRCore iOS/Shared/SpendingStore.swift iOS/Tests/Recovery/main.swift -o "$scratch/recovery-checks"
LD_LIBRARY_PATH="$scratch${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" "$scratch/recovery-checks"
