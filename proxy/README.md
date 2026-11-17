# 語師 内测代理（Cloudflare Pages Functions / Workers）

给学生发「邀请码 + 代理地址」，学生无需自己的 DeepSeek Key：前端填邀请码走本代理，
Key 只存在服务端 secret，按码每日限 20 次，不记录聊天内容与 IP。

## 国内可达性（重要）

- **`*.workers.dev` 在国内被 DNS+SNI 封锁，打不开**；`*.pages.dev` 实测国内可达。
- 因此**主部署走 Pages Functions**（`proxy-pages/`，catch-all 路由复用同一份核心逻辑
  `proxy-pages/functions/_worker.js`），地址形如 `https://goshi-api.pages.dev`。
- `proxy/worker.js` 现在只是 re-export 同一核心，保留 Worker 部署仅作海外/备份用途。
- 要更稳更快可后续绑自定义域名（需自有域名；国内最稳再 ICP 备案），非必需。

## 部署步骤（Pages 主线）

1. 安装 wrangler 并登录（需要你自己的 Cloudflare 账号）：
   ```bash
   npm i -g wrangler
   wrangler login
   ```
2. 创建 KV namespace（邀请码 / 限次 / 日聚合 共用）：
   ```bash
   wrangler kv namespace create INVITES
   ```
   把返回的 `id` 填进 `proxy-pages/wrangler.toml`（和 `proxy/wrangler.toml`）的 `kv_namespaces[0].id`。
3. 生成邀请码并上传 KV（**必须加 `--remote`**，否则只写本地模拟）：
   ```bash
   node scripts/gen-codes.js 20
   wrangler kv bulk put codes.json --binding=INVITES --remote
   ```
   `codes.csv` 留在本地填「码 → 学生昵称」备注，**不进 git**。
4. 设置两个 secret（**不要**写进 toml 或提交；Pages 用 `pages secret put`）：
   ```bash
   cd proxy-pages
   wrangler pages secret put DEEPSEEK_KEY --project-name goshi-api   # 你的 key，服务端代持
   wrangler pages secret put ADMIN_CODE  --project-name goshi-api   # /stats 管理口令
   ```
   管道喂值时去掉行尾换行：`printf '%s' "$(cat key文件)" | wrangler pages secret put …`。
5. 配置 CORS：编辑 `proxy-pages/wrangler.toml` 的 `[vars] ALLOWED_ORIGIN` 为前端实际 origin
   （多个逗号分隔）。本地联调加 `http://localhost:8765`。
6. 创建项目并部署：
   ```bash
   wrangler pages project create goshi-api --production-branch main
   wrangler pages deploy public --project-name goshi-api
   ```
   得到 `https://goshi-api.pages.dev`。发给学生填到 应用设置 → 内测模式 → 代理地址。
7. **改 secret / vars / 绑定后必须重新 `pages deploy`**：Pages 在部署时快照配置，
   事后 `secret put` 不会自动作用于已上线的部署。

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/v1/chat/completions` | `X-Invite-Code` | 流式转发 DeepSeek，原样返回 |
| GET | `/v1/models` | `X-Invite-Code` | 邀请码核验（前端门禁）/测试连接，**不消耗每日次数** |
| POST | `/event` | `X-Invite-Code` | 匿名事件 `{code,event,device}`，如 `review_done` |
| GET | `/stats` | `X-Admin-Code` | 最近 14 天按天聚合：请求数/活跃码/每码分布/事件数 |

限次：key = `rl:<码>:<YYYY-MM-DD>`，TTL 48h，每码每天 20 次，第 21 次返回 429。
**教师码不限次**：KV value 带 `"teacher": true` 的码跳过限次（仍计统计），用 `bash scripts/gen-codes.sh 1 teacher` 生成。
`/v1/models` 只验码不计次。错码 / 缺码返回 403。`/stats` 无口令或错口令返回 403。

**一码一设备**：前端每次请求带 `X-Device-Id`（localStorage 持久 UUID）。普通码首个激活设备写入
KV value 的 `device` 字段，之后其他设备（或缺设备头）一律 403 `code bound to another device`；
教师码（`teacher:true`）不绑定。学生换设备：吊销旧码、发新码（不做解绑）。

## 查看回访表

```bash
node scripts/stats.js https://goshi-api.pages.dev <ADMIN_CODE>
```

## 验收清单

- 正确邀请码能问答（流式）；
- 错码 403；
- 同码第 21 次 429；
- 无口令访问 `/stats` 403；
- 非 `ALLOWED_ORIGIN` 的浏览器跨域请求被 CORS 拦截。

注意：用脚本验收时带浏览器 User-Agent；Cloudflare 边缘会对 python-urllib 等
非浏览器 UA 返回 `error code: 1010`（bot 拦截），那是边缘行为不是代理逻辑。

## 安全说明

- `DEEPSEEK_KEY`、`ADMIN_CODE` 仅为服务端 secret；`codes.json`/`codes.csv`/`*.local` 含邀请码/口令，
  已加入 `.gitignore`，绝不进公开仓库。
- 代理不 `console.log` 请求体、不记录 IP；KV 只存计数与聚合，不存聊天内容。
- 邀请码泄露即可刷你的额度：发现滥用可在 KV 删除该码
  （`wrangler kv key delete <码> --binding=INVITES --remote`）。