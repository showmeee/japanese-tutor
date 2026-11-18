#!/bin/bash
# 学情看板：只在本机 (127.0.0.1) 打开，不进公开 app，学生/邀测陌生人看不到。
#   bash scripts/usage.sh        生成昵称映射 + 起本地服务 + 浏览器打开（口令自动填）
#   bash scripts/usage.sh stop   停掉本地服务
set -e
cd "$(dirname "$0")/.."
PORT=8799
PIDFILE=/tmp/goshi-usage.pid

if [ "$1" = "stop" ]; then
  if [ -f "$PIDFILE" ]; then kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"; fi
  echo "已停止本机学情看板服务。"
  exit 0
fi

# 码→昵称映射（仅本机使用，gitignore）
python3 - <<'PY'
import csv, json, os
m = {}
if os.path.exists('codes.csv'):
    with open('codes.csv', newline='') as f:
        for row in csv.DictReader(f):
            c = (row.get('code') or '').strip()
            if c: m[c] = (row.get('note') or '').strip()
with open('tools/codes.local.json', 'w') as f:
    json.dump(m, f, ensure_ascii=False, indent=1)
PY

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  : # 服务已在跑
else
  ( cd tools && nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/goshi-usage-http.log 2>&1 & echo $! > "$PIDFILE" )
  sleep 0.8
fi

if [ ! -f proxy/admin_code.local ]; then
  echo "⚠️ 找不到 proxy/admin_code.local，请在浏览器里手输管理口令。"
  open "http://127.0.0.1:$PORT/usage.html"
else
  ADMIN="$(cat proxy/admin_code.local)"
  open "http://127.0.0.1:$PORT/usage.html#${ADMIN}"
fi
echo "✅ 学情看板已在浏览器打开（仅本机可见，口令取自 proxy/admin_code.local）。"
echo "   停止服务：bash scripts/usage.sh stop"