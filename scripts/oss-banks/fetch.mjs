// 下载三个开源 JLPT 题库原始数据（api.github.com；token 仅进程内使用，绝不打印）
// 用法: node scripts/oss-banks/fetch.mjs [下载目录=/tmp/goshi-banks]
// 下载三个开源题库到 /tmp/j12/banks/（api.github.com，github.com 被墙）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// token 从 keychain 取，仅进程内使用，绝不打印（匿名限 60 次/小时不够用）
let token = '';
try {
  const cred = execFileSync('git', ['credential-osxkeychain', 'get'], {
    input: 'protocol=https\nhost=github.com\n\n',
  }).toString();
  for (const line of cred.split('\n')) if (line.startsWith('password=')) token = line.slice(9);
} catch (e) {}
const H = { 'User-Agent': 'goshi-research', Accept: 'application/vnd.github+json' };
if (token) H.Authorization = 'Bearer ' + token;
const ROOT = process.argv[2] || '/tmp/goshi-banks';
const get = async (u) => {
  const r = await fetch(u, { headers: H });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u);
  return r.json();
};
const repos = {
  'aic': 'Aymeric-Dcn/Japanese-AI-Coach-bank',
  'oj': 'hoangkien1703/Open-JLPT',
  'js': 'gauravaccentureproducts/JLPTSuccess',
};
const want = {
  aic: p => /^exercises\/.*\.jsonl$/.test(p) || p === 'manifest.json' || p === 'LICENSE.md',
  oj: p => /^app\/src\/main\/assets\/questions\/n[1-5]\/(grammar|vocabulary|reading)\.json$/.test(p),
  js: p => /^N[1-5]\/data\/questions\.json$/.test(p) || /^N[1-5]\/data\/papers\/.*\.json$/.test(p) || p === 'LICENSE',
};
for (const [key, repo] of Object.entries(repos)) {
  const meta = await get('https://api.github.com/repos/' + repo);
  const branch = meta.default_branch;
  const tree = await get(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
  if (tree.truncated) console.log(key, 'WARNING tree truncated');
  const files = tree.tree.filter(t => t.type === 'blob' && want[key](t.path));
  console.log(key, repo, '选中', files.length, '个文件');
  let ok = 0, fail = 0;
  for (const f of files) {
    const dest = path.join(ROOT, key, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      const j = await get(`https://api.github.com/repos/${repo}/contents/${f.path}?ref=${branch}`);
      if (!j.content) throw new Error('no content (size ' + j.size + ')');
      fs.writeFileSync(dest, Buffer.from(j.content, 'base64'));
      ok++;
    } catch (e) { fail++; console.log('  FAIL', f.path, e.message); }
  }
  console.log(key, '下载完成 ok=' + ok, 'fail=' + fail);
}
console.log('ALL_DONE');