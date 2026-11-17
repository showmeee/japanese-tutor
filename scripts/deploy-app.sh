#!/bin/bash
# 把前端 app 部署到公网 https://goshi-app.pages.dev
#   bash scripts/deploy-app.sh
# 只上传白名单内的公开资源；邀请码、口令、代理代码绝不会上传。
# 改了 index.html 等静态文件后：先把 sw.js 的 VERSION 加一，再跑本脚本。
set -e
export PATH="/Users/wangxiaopeng/Library/Application Support/Quark/quark-agent/resources/bins:$PATH"
cd "$(dirname "$0")/.."
if command -v wrangler >/dev/null 2>&1; then W=wrangler;
elif [ -x /tmp/j12/wtools/node_modules/.bin/wrangler ]; then W=/tmp/j12/wtools/node_modules/.bin/wrangler;
else W="npx --yes wrangler"; fi
STAGE=$(mktemp -d)
for f in index.html sw.js manifest.webmanifest bank-builtin.json bank.html; do cp "$f" "$STAGE/"; done
cp -R vendor icons audio "$STAGE/"
$W pages project create goshi-app --production-branch main 2>/dev/null || true
$W pages deploy "$STAGE" --project-name goshi-app --commit-dirty=true
rm -rf "$STAGE"
echo "✅ 前端已上线：https://goshi-app.pages.dev"