#!/usr/bin/env node
// 读 bank-builtin.json 生成静态题库分享页 bank.html（自包含、无外部依赖，可离线/子路径打开）。
// 重新生成：node scripts/build-bank-page.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(root, 'bank-builtin.json'), 'utf8'));
const qs = (Array.isArray(D) ? D : (D.questions || [])).filter(q => q && q.id);

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5'];
const COLORS = { N1: '#FF2D55', N2: '#FF9500', N3: '#007AFF', N4: '#5AC8FA', N5: '#34C759' };
const TYPES = [
  ['KANJI_READING', '汉字读音'], ['KANJI_WRITING', '汉字写法'], ['VOCAB_FILL', '词汇填空'],
  ['CONTEXT', '文脉规定'], ['PARAPHRASE', '近义替换'], ['USAGE', '用法'],
  ['GRAMMAR_FILL', '语法填空'], ['GRAMMAR_ORDER', '排序'],
];
const typeLabel = t => (TYPES.find(x => x[0] === t) || [t, t])[1];

let body = '';
for (const lv of LEVELS) {
  const inLv = qs.filter(q => q.level === lv);
  if (!inLv.length) continue;
  body += `<section class="lv"><h2 style="color:${COLORS[lv]}">${lv} <span class="cnt">${inLv.length} 题</span></h2>`;
  const extra = [...new Set(inLv.map(q => q.type))].filter(t => !TYPES.some(x => x[0] === t)).map(t => [t, t]);
  for (const [t, label] of TYPES.concat(extra)) {
    const group = inLv.filter(q => q.type === t);
    if (!group.length) continue;
    body += `<h3>${label} <span class="cnt">${group.length}</span></h3>`;
    for (const q of group) {
      const choices = q.choices.map((c, i) =>
        `<li class="${i === q.answer ? 'ok' : ''}"><span class="no">${i + 1}</span> ${esc(c)}${i === q.answer ? ' <b>✓ 正确</b>' : ''}</li>`).join('');
      body += `<details class="q">
<summary><span class="prompt">${esc(q.prompt)}</span><span class="meta">${esc(q.paper || '')}</span></summary>
<div class="body">
<ol class="choices">${choices}</ol>
<p class="src">答案 ${q.answer + 1} · 来源：${esc(q.source || '')}</p>
<a class="ask" href="index.html?ask=${encodeURIComponent(q.id)}">问 AI 讲解 →</a>
</div>
</details>`;
    }
  }
  body += '</section>';
}

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>語師 · 真题库（JLPT 官方免费样题）</title>
<style>
:root{--bg:#F2F2F7;--card:#fff;--text:#1C1C1E;--text2:#3C3C43;--text3:#8E8E93;--sep:rgba(60,60,67,.12);--primary:#007AFF}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
header{position:sticky;top:0;background:var(--card);border-bottom:1px solid var(--sep);padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:5}
header a.home{color:var(--primary);text-decoration:none;font-weight:600;white-space:nowrap}
header h1{font-size:17px;margin:0;flex:1}
header .total{color:var(--text3);font-size:13px;white-space:nowrap}
main{max-width:820px;margin:0 auto;padding:16px}
.note{background:var(--card);border:1px solid var(--sep);border-radius:12px;padding:10px 14px;color:var(--text2);font-size:13px;margin-bottom:16px}
.lv{margin-bottom:24px}.lv h2{font-size:20px;margin:8px 0}.lv h3{font-size:14px;color:var(--text2);margin:14px 0 6px}
.cnt{font-size:12px;color:var(--text3);font-weight:400}
details.q{background:var(--card);border:1px solid var(--sep);border-radius:12px;margin:8px 0;overflow:hidden}
summary{cursor:pointer;padding:12px 14px;list-style:none;display:block}
summary::-webkit-details-marker{display:none}
summary .prompt{white-space:pre-line;display:block}
summary .meta{display:block;color:var(--text3);font-size:12px;margin-top:4px}
details[open] summary{border-bottom:1px solid var(--sep)}
.body{padding:12px 14px}
ol.choices{list-style:none;margin:0;padding:0}
ol.choices li{padding:6px 8px;border-radius:8px;margin:2px 0}
ol.choices li.ok{background:rgba(52,199,89,.12)}
ol.choices .no{display:inline-block;min-width:20px;color:var(--text3)}
.src{color:var(--text3);font-size:12px;margin:10px 0 6px}
a.ask{display:inline-block;color:var(--primary);text-decoration:none;font-weight:600;font-size:14px}
</style>
</head>
<body>
<header>
<a class="home" href="index.html">← 語師</a>
<h1>真题库 · JLPT 官方免费样题</h1>
<span class="total">${qs.length} 题</span>
</header>
<main>
<p class="note">本页为 jlpt.jp 官方免费公开样题（2018 / 2012）节选，非完整套卷；点击题目展开选项与答案，「问 AI 讲解」跳回应用预填该题。完整历年真题有版权，仅由教师自购后私下导入，不在本页公开。</p>
${body}
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'bank.html'), html);
console.log('bank.html written:', qs.length, 'questions');