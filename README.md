# 語師 — 日本語教学助手

面向日语课堂的单文件 PWA：JLPT 语法知识库、DeepSeek 流式问答与真题解析、拍照 OCR、
假名注音、日语朗读、FSRS 间隔复习、本地真题库（IndexedDB）。
学生打开一条链接即用；API Key 只存各自浏览器 localStorage，不上传。

## 本地运行

纯静态，无需构建：

```bash
python3 -m http.server 8765
# 打开 http://localhost:8765/index.html
```

 service worker 会缓存静态资源；改任何静态文件后把 `sw.js` 的 `VERSION` 加一，
客户端刷新两次即可拿到新版本。

## 内置真题库与分享页

- `bank-builtin.json`：仅含 **jlpt.jp 官方免费公开样题**（2018 / 2012）与教师有权分发的共享题。
  首次启动自动导入到本地 IndexedDB；`localStorage.goshi_builtin_bank_done` 记录已处理 id。
- `bank.html`：静态题库分享页（自包含、可离线），按 N1~N5 + 题型分组，点击展开选项与答案，
  每题「问 AI 讲解」跳回 `index.html?ask=<id>` 预填题目（不自动发请求）。
  重新生成：
  ```bash
  node scripts/build-bank-page.js
  ```
- **版权红线**：完整历年真题（公式問題集等）有版权，**不进公开仓库**；只由教师自购后
  通过应用内「导入 JSON / 文本」私下导入，存本地浏览器。

## 部署到 GitHub Pages / Cloudflare Pages

所有资源均为相对路径，可直接放在子路径（如 `/japanese-tutor/`）下：

- GitHub Pages：仓库 Settings → Pages 开启（注意 `github.io` 在中国大陆可能打不开）。
- 推荐 Cloudflare Pages / Vercel，或国内已备案域名，发给学生一条链接即可。
- 本地模拟子路径验证：
  ```bash
  mkdir -p /tmp/subpath && ln -s "$PWD" /tmp/subpath/japanese-tutor
  (cd /tmp/subpath && python3 -m http.server 8766)
  # 打开 http://localhost:8766/japanese-tutor/index.html
  ```

## 内测代理（邀请码，学生无需自填 Key）

见 [`proxy/README.md`](proxy/README.md)。要点：

- Cloudflare Workers 代持 `DEEPSEEK_KEY`（secret），学生填邀请码走代理，每码每天 20 次。
- `node scripts/gen-codes.js N` 生成邀请码 → `codes.json` 上传 KV、`codes.csv` 本地填昵称（均不进 git）。
- `node scripts/stats.js <PROXY_URL> <ADMIN_CODE>` 打印最近 14 天回访表。
- 前端设置 → 内测模式：填邀请码 + 代理地址；保留自带 Key（BYOK）高级选项。

## 隐私与安全

- AI 输出经 DOMPurify 净化后再渲染（防 XSS）；错误回显用 textContent。
- Key / 邀请码 / 管理口令都不进仓库；代理不记录聊天内容与 IP。