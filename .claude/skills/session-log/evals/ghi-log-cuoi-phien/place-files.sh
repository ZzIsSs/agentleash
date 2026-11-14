#!/usr/bin/env bash
# Dựng repo mẫu ngay tại thư mục chạy test.
set -eu
bash "$(dirname "$0")/../../test-fixtures/tao-repo-mau.sh" ghi .
