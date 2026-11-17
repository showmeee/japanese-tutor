# 語師 内测代理（Cloudflare Workers）

给学生发「邀请码 + 代理地址」，学生无需自己的 DeepSeek Key：前端填邀请码走本代理，
Key 只存在 Worker 的服务端 secret，按码每日限 20 次，不记录聊天内容与 IP。

## 部署步骤

1. 安装 wrangler 并登录（需要你自己的 Cloudflare 账号）：
   ```bash
   npm i -g wrangler
   wrangler login
   ```
2. 创建 KV namespace（邀请码 / 限次 / 日聚合 共用）：
   ```bash
   wrangler kv namespace create INVITES
   ```
   把返回的 `id` 填进 `wrangler.toml` 的 `kv_namespaces[0].id`。
3. 设置两个 secret（**不要**写进 toml 或提交）：
   ```bash
   wrangler secret put DEEPSEEK_KEY   # 你的 DeepSeek key，服务端代持
   wrangler secret put ADMIN_CODE     # /stats 管理口令，自设一个强口令
   ```
4. 配置 CORS：编辑 `wrangler.toml` 的 `[vars] ALLOWED_ORIGIN` 为你的 Pages 域名
   （如 `https://showmeee.github.io` 或自定义域；多个用逗号分隔）。
   本地联调可临时追加 `http://localhost:8765`，上线前移除。
5. 生成邀请码并上传 KV：
   ```bash
   node scripts/gen-codes.js 20                 # 生成 20 个 8 位码
   wrangler kv bulk put codes.json --binding=INVITES
   ```
   `codes.csv` 留在本地填「码 → 学生昵称」备注，**不进 git**。
6. 部署：
   ```bash
   wrangler deploy
   ```
   得到 `https://goshi-proxy.<你的子域>.workers.dev`。把它发给学生填到
   应用设置 → 内测模式 → 代理地址；邀请码一对一发给学生。

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/v1/chat/completions` | `X-Invite-Code` | 流式转发 DeepSeek，原样返回 |
| GET | `/v1/models` | `X-Invite-Code` | 转发模型列表（测试连接用） |
| POST | `/event` | `X-Invite-Code` | 匿名事件 `{code,event,device}`，如 `review_done` |
| GET | `/stats` | `X-Admin-Code` | 最近 14 天按天聚合：请求数/活跃码/每码分布/事件数 |

限次：key = `rl:<码>:<YYYY-MM-DD>`，TTL 48h，每码每天 20 次，第 21 次返回 429。
错码 / 缺码返回 403。`/stats` 无口令或错口令返回 403。

## 查看回访表

```bash
node scripts/stats.js https://goshi-proxy.<子域>.workers.dev <ADMIN_CODE>
```

## 验收清单

- 正确邀请码能问答（流式）；
- 错码 403；
- 同码第 21 次 429；
- 无口令访问 `/stats` 403；
- 非 `ALLOWED_ORIGIN` 的浏览器跨域请求被 CORS 拦截。

## 安全说明

- `DEEPSEEK_KEY`、`ADMIN_CODE` 仅为 Worker secret；`codes.json`/`codes.csv` 含邀请码，
  已加入 `.gitignore`，绝不进公开仓库。
- Worker 不 `console.log` 请求体、不记录 IP；KV 只存计数与聚合，不存聊天内容。
- 邀请码泄露即可刷你的额度：发现滥用可在 KV 删除该码（`wrangler kv key delete <码> --binding=INVITES`）。