#!/usr/bin/env node
// 生成 N 个 8 位邀请码。
//   node scripts/gen-codes.js [N=10]
// 输出：codes.json（wrangler kv bulk put 上传 KV 的格式）+ codes.csv（码+备注列，本地填昵称，不进 git）。
// 重复运行会保留旧码、只追加新码。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const N = parseInt(process.argv[2] || '10', 10);
const root = path.join(__dirname, '..');
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混的 I/O/0/1

let old = [];
try { old = JSON.parse(fs.readFileSync(path.join(root, 'codes.json'), 'utf8')); } catch (e) {}
const seen = new Set(old.map(e => e.key));
const added = [];
while (added.length < N) {
  let c = '';
  for (let i = 0; i < 8; i++) c += ALPH[crypto.randomInt(ALPH.length)];
  if (seen.has(c)) continue;
  seen.add(c);
  added.push({ key: c, value: JSON.stringify({ note: '', createdAt: new Date().toISOString() }) });
}
const merged = old.concat(added);
fs.writeFileSync(path.join(root, 'codes.json'), JSON.stringify(merged, null, 1));
const csv = ['code,note'].concat(merged.map(e => {
  let note = '';
  try { note = (JSON.parse(e.value).note || ''); } catch (err) {}
  return e.key + ',' + note;
})).join('\n') + '\n';
fs.writeFileSync(path.join(root, 'codes.csv'), csv);
console.log('新增', added.length, '个邀请码，累计', merged.length);
console.log('codes.json → 上传 KV：wrangler kv bulk put codes.json --binding=INVITES（见 proxy/README.md）');
console.log('codes.csv → 本地填昵称备注，不进 git');