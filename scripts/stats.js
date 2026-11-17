#!/usr/bin/env node
// 终端打印最近 14 天回访表。
//   node scripts/stats.js <PROXY_URL> <ADMIN_CODE>
// ADMIN_CODE 只在你本机终端使用，不要写进代码或提交。
const base = process.argv[2];
const admin = process.argv[3];
if (!base || !admin) {
  console.error('用法: node scripts/stats.js <PROXY_URL> <ADMIN_CODE>');
  process.exit(1);
}
fetch(base.replace(/\/$/, '') + '/stats', { headers: {
  'X-Admin-Code': admin,
  // Cloudflare 边缘会拦非浏览器 UA（error 1010），脚本也要带浏览器 UA
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
} })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => {
    console.log('日期\t请求数\t活跃码\t复习完成\t每码次数分布');
    for (const day of d.days) {
      console.log([
        day.date, day.req, day.activeCodes,
        (day.events && day.events.review_done) || 0,
        JSON.stringify(day.codes),
      ].join('\t'));
    }
  })
  .catch(e => { console.error('stats 失败:', e.message); process.exit(1); });