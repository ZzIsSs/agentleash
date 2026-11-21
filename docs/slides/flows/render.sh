#!/usr/bin/env bash
# Xuất các sơ đồ HTML trong thư mục này thành PNG nền trong suốt (3520x1560) bằng Chrome headless.
# Chạy trong Git Bash trên Windows: bash docs/slides/flows/render.sh
set -uo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
DIR="$(cygpath -w "$PWD")"
URL_DIR="$(cygpath -m "$PWD")"
PROFILE="$(cygpath -w "${TEMP:-/tmp}")\\agentleash-flows-chrome"
for f in *.html; do
  out="$DIR\\${f%.html}.png"
  if "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" \
      --force-device-scale-factor=2 --window-size=1760,780 --default-background-color=00000000 \
      --virtual-time-budget=10000 --screenshot="$out" "file:///$URL_DIR/$f" 2>&1 | grep -q "bytes written"; then
    echo "đã xuất ${f%.html}.png"
  else
    echo "lỗi khi xuất $f" >&2
    exit 1
  fi
done
