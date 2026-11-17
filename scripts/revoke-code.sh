#!/bin/bash
# 吊销一个邀请码（学生立刻被门禁拦下，无法再用）。
#   bash scripts/revoke-code.sh ABCD1234
set -e
export PATH="/Users/wangxiaopeng/Library/Application Support/Quark/quark-agent/resources/bins:$PATH"
cd "$(dirname "$0")/.."
CODE="$1"
if [ -z "$CODE" ]; then echo "用法: bash scripts/revoke-code.sh <邀请码>"; exit 1; fi
if command -v wrangler >/dev/null 2>&1; then W=wrangler;
elif [ -x /tmp/j12/wtools/node_modules/.bin/wrangler ]; then W=/tmp/j12/wtools/node_modules/.bin/wrangler;
else W="npx --yes wrangler"; fi
cd proxy-pages
$W kv key delete "$CODE" --binding=INVITES --remote
echo "✅ 已吊销 $CODE（本地 codes.csv 里的记录可自行删除）"