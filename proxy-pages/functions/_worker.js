// 語師 内测代理共享核心（Cloudflare Worker 与 Pages Functions 共用这一份逻辑）
// 邀请码 gating + 按码每日限次 + 转发 DeepSeek（key 只在服务端 secret）+ 匿名统计。
// 不记录聊天内容、不记录 IP。
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DAY_LIMIT = 20;
const RL_TTL = 48 * 3600;        // 限次 key TTL 48h
const STATS_TTL = 45 * 24 * 3600; // 日聚合保留 45 天（够 14 天回访表）

function corsHeaders(origin, env) {
  const allow = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { Vary: 'Origin' };
  if (origin && allow.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Invite-Code,X-Admin-Code';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function dayKey(offset = 0) {
  return new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
}
async function inviteMeta(env, code) {
  if (!code) return null;
  const raw = await env.INVITES.get(code);
  if (raw === null) return null;
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}
async function bumpRate(env, code) {
  const k = 'rl:' + code + ':' + dayKey();
  const next = parseInt((await env.INVITES.get(k)) || '0', 10) + 1;
  await env.INVITES.put(k, String(next), { expirationTtl: RL_TTL });
  return next;
}
async function bumpStats(env, code, kind, name) {
  const k = 'stats:' + dayKey();
  let s = { req: 0, codes: {}, events: {} };
  try { s = JSON.parse((await env.INVITES.get(k)) || 'null') || s; } catch (e) {}
  if (kind === 'req') { s.req++; s.codes[code] = (s.codes[code] || 0) + 1; }
  else { s.events[name] = (s.events[name] || 0) + 1; }
  await env.INVITES.put(k, JSON.stringify(s), { expirationTtl: STATS_TTL });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = url.pathname;

    if (path === '/stats' && request.method === 'GET') {
      const admin = request.headers.get('X-Admin-Code') || url.searchParams.get('code') || '';
      if (!env.ADMIN_CODE || admin !== env.ADMIN_CODE) return json({ error: 'forbidden' }, 403, cors);
      const days = [];
      for (let i = 0; i < 14; i++) {
        const d = dayKey(i);
        let s = null;
        try { s = JSON.parse((await env.INVITES.get('stats:' + d)) || 'null'); } catch (e) {}
        days.push({
          date: d,
          req: s ? s.req : 0,
          activeCodes: s ? Object.keys(s.codes).length : 0,
          codes: s ? s.codes : {},
          events: s ? s.events : {},
        });
      }
      return json({ days }, 200, cors);
    }

    if (path === '/event' && request.method === 'POST') {
      const code = request.headers.get('X-Invite-Code') || '';
      if (!(await inviteMeta(env, code))) return json({ error: 'invalid invite' }, 403, cors);
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const name = String(body.event || '').slice(0, 40);
      if (name) await bumpStats(env, code, 'event', name);
      return json({ ok: true }, 200, cors);
    }

    const isChat = path === '/v1/chat/completions' && request.method === 'POST';
    const isModels = path === '/v1/models' && request.method === 'GET';
    if (isChat || isModels) {
      const code = request.headers.get('X-Invite-Code') || '';
      const meta = await inviteMeta(env, code);
      if (!meta) return json({ error: 'invalid invite' }, 403, cors);
      // /v1/models 仅作邀请码核验，不消耗每日次数；只有真实问答计次
      // 教师码（KV value 带 teacher:true）不限次，但仍计入统计
      if (isChat) {
        if (!meta.teacher) {
          const n = await bumpRate(env, code);
          if (n > DAY_LIMIT) return json({ error: 'daily limit exceeded' }, 429, cors);
        }
        await bumpStats(env, code, 'req');
      }
      const upstream = await fetch(DEEPSEEK_BASE + path, {
        method: request.method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_KEY },
        body: isChat ? request.body : undefined,
      });
      const h = { ...cors };
      const ct = upstream.headers.get('Content-Type');
      if (ct) h['Content-Type'] = ct;
      return new Response(upstream.body, { status: upstream.status, headers: h });
    }

    return json({ error: 'not found' }, 404, cors);
  },
};