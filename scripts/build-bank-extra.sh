#!/bin/bash
# 一键更新开源增量题库：下载三个开源仓库 → 转换校验 → 生成 bank-extra-*.json
#   bash scripts/build-bank-extra.sh
# 生成的 JSON 在项目根目录，已 gitignore（含无许可证内容，仅限本地私有导入）。
# 导入方式：app 🗂️题库 → 📄导入 JSON/文本文件，逐个选择 bank-extra-oj/aic/js.json。
# 增量安全：新 id 前缀 oj-/aic-/js-，与现有 494 题永不冲突；重复导入自动跳过。
set -e
export PATH="/Users/wangxiaopeng/Library/Application Support/Quark/quark-agent/resources/bins:$PATH"
cd "$(dirname "$0")/.."
node scripts/oss-banks/fetch.mjs
node scripts/oss-banks/convert.mjs
echo ""
echo "✅ 增量题库已生成：bank-extra-oj.json / bank-extra-aic.json / bank-extra-js.json"
echo "   到 app 🗂️题库 → 📄导入 JSON/文本文件 逐个导入即可（重复导入会自动跳过）。"