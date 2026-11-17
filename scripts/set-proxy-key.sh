#!/bin/bash
# 一次性把 DeepSeek key 设为邀测代理的服务端 secret 并重新部署。
# key 只进 Cloudflare secret：输入不显示、不打印、不进 git。
# 用法：bash scripts/set-proxy-key.sh
set -e
export PATH="/Users/wangxiaopeng/Library/Application Support/Quark/quark-agent/resources/bins:$PATH"
cd "$(dirname "$0")/../proxy-pages"
if command -v wrangler >/dev/null 2>&1; then W=wrangler;
elif [ -x /tmp/j12/wtools/node_modules/.bin/wrangler ]; then W=/tmp/j12/wtools/node_modules/.bin/wrangler;
else W="npx --yes wrangler"; fi
read -s -p "粘贴新 DeepSeek key（输入不显示，回车结束）: " k; echo
if [ -z "$k" ]; then echo "未输入 key，退出"; exit 1; fi
printf '%s' "$k" | $W pages secret put DEEPSEEK_KEY --project-name goshi-api
unset k
$W pages deploy public --project-name goshi-api --commit-dirty=true
echo "✅ key 已设为服务端 secret 并重新部署。回 Qoder 说一声即可验收。"