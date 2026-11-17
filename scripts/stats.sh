#!/bin/bash
# 查看最近 14 天用量统计（每天请求数/活跃码/每码分布/复习完成数）。
#   bash scripts/stats.sh
set -e
export PATH="/Users/wangxiaopeng/Library/Application Support/Quark/quark-agent/resources/bins:$PATH"
cd "$(dirname "$0")/.."
if [ ! -f proxy/admin_code.local ]; then echo "缺少 proxy/admin_code.local（管理口令文件）"; exit 1; fi
node scripts/stats.js https://goshi-api.pages.dev "$(cat proxy/admin_code.local)"