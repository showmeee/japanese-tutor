#!/bin/bash
# 一键生成邀请码并上传云端，立即生效。
#   bash scripts/gen-codes.sh        默认生成 10 个普通码（每码每天 20 次）
#   bash scripts/gen-codes.sh 20     生成 20 个普通码
#   bash scripts/gen-codes.sh 1 teacher   生成 1 个教师码（不限次，只给老师自己）
# 新码追加到 codes.csv（旧码和已填的学生昵称保留），上传后马上可用。
set -e
export PATH="/Users/wangxiaopeng/Library/Application Support/Quark/quark-agent/resources/bins:$PATH"
cd "$(dirname "$0")/.."
N="${1:-10}"
if command -v wrangler >/dev/null 2>&1; then W=wrangler;
elif [ -x /tmp/j12/wtools/node_modules/.bin/wrangler ]; then W=/tmp/j12/wtools/node_modules/.bin/wrangler;
else W="npx --yes wrangler"; fi
node scripts/gen-codes.js "$N" "$2"
cd proxy-pages
$W kv bulk put ../codes.json --binding=INVITES --remote
echo ""
echo "✅ 新邀请码已生效。打开项目根目录的 codes.csv 查看/复制，note 列可填学生昵称。"