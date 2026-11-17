// 开源题库 → 語師增量 JSON（新 id 前缀 oj-/aic-/js-，校验+跨源去重+排序★机械验答案）
// 用法: node scripts/oss-banks/convert.mjs [下载目录] [输出目录=项目根]
// 输出 bank-extra-{oj,aic,js}.json 已 gitignore：仅限本地私有导入，不进公开仓库。
// 三个开源题库 → 語師增量 JSON（新 id 前缀，绝不覆盖现有 494 题）
// 输出: projects/japanese-tutor/bank-extra-{oj,aic,js}.json（本地私有导入，gitignore）
import fs from 'node:fs';
import path from 'node:path';
const R = process.argv[2] || '/tmp/goshi-banks';
const OUT = process.argv[3] || new URL('../..', import.meta.url).pathname;
const stripHtml = s => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<u>/g, '').replace(/<\/u>/g, '')
  .replace(/<[^>]+>/g, '').trim();
const norm = s => String(s || '').normalize('NFKC')
  .replace(/[\s　]+/g, '')
  .replace(/[、。，．,.！？!?・…‥「」『』"'()（）\[\]【】〔〕＿_★＊*−-]+/g, '')
  .toLowerCase();
const key = q => norm(q.prompt) + '|' + q.choices.map(norm).sort().join(',') +
  (q.type === 'GRAMMAR_ORDER' ? '|' + String(q.prompt).indexOf('★') : '');

const rejected = [];
const seenKeys = new Map(); // key -> id（跨源内容去重）
const seenIds = new Set();
// 现有 494 题先占位
const builtin = JSON.parse(fs.readFileSync(OUT + '/bank-builtin.json', 'utf8'));
for (const q of (builtin.questions || builtin)) { seenIds.add(q.id); seenKeys.set(key(q), q.id); }

function push(list, q, srcLabel) {
  const fail = m => rejected.push(srcLabel + ' ' + (q.id || '?') + '：' + m);
  if (!q.prompt || !q.prompt.trim()) return fail('题干为空');
  if (!Array.isArray(q.choices) || q.choices.length < 3 || q.choices.length > 4) return fail('选项数 ' + (q.choices || []).length);
  if (q.choices.some(c => !String(c).trim())) return fail('选项为空');
  if (new Set(q.choices.map(c => c.trim())).size !== q.choices.length) return fail('选项重复');
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) return fail('答案越界 ' + q.answer);
  if (q.type === 'GRAMMAR_ORDER' && (q.choices.length !== 4 || !q.prompt.includes('★'))) return fail('排序题格式不符');
  if (seenIds.has(q.id)) return fail('id 冲突');
  const k = key(q);
  if (seenKeys.has(k)) return fail('内容与 ' + seenKeys.get(k) + ' 重复');
  seenIds.add(q.id); seenKeys.set(k, q.id);
  q.choices = q.choices.map(c => String(c).trim());
  list.push(q);
}

// ---------- Open-JLPT（原创但无许可证：仅限个人使用） ----------
let ojQs = [], ojPassages = new Map();
const ojTypeMap = { GRAMMAR_FORM: 'GRAMMAR_FILL', SENTENCE_ORDER: 'GRAMMAR_ORDER', ORTHOGRAPHY: 'KANJI_WRITING' };
const ojKindLabel = { grammar: '文法', vocabulary: '文字・語彙', reading: '読解' };
for (const lv of ['n1', 'n2', 'n3', 'n4', 'n5']) {
  for (const kind of ['grammar', 'vocabulary', 'reading']) {
    const j = JSON.parse(fs.readFileSync(`${R}/oj/app/src/main/assets/questions/${lv}/${kind}.json`, 'utf8'));
    for (const p of (j.passages || [])) ojPassages.set(p.id, { id: p.id, title: p.title || '', text: stripHtml(p.text) });
    for (const q of (j.questions || [])) {
      push(ojQs, {
        id: 'oj-' + q.id,
        level: lv.toUpperCase(),
        type: ojTypeMap[q.type] || q.type,
        prompt: stripHtml(q.prompt),
        choices: q.choices,
        answer: q.answer,
        explanation: String(q.explanation || '').trim(),
        source: 'Open-JLPT 原创模拟（hoangkien1703/Open-JLPT，无许可证，仅限个人使用）',
        paper: `Open-JLPT · ${lv.toUpperCase()} ${ojKindLabel[kind]}`,
        passageId: q.passageId || undefined,
      }, 'OJ');
    }
  }
}
ojQs = verifyOrdering(ojQs, 'OJ');
fs.writeFileSync(OUT + '/bank-extra-oj.json', JSON.stringify({
  _license: '无许可证（作者声明全部原创）。仅供个人学习导入，不得再分发。',
  _source: 'https://github.com/hoangkien1703/Open-JLPT',
  passages: [...ojPassages.values()],
  questions: ojQs,
}, null, 1));

// ---------- AI-Coach-bank（CC BY-SA 4.0，Tatoeba 例句） ----------
let aicQs = [];
const aicTypeMap = { grammar: 'GRAMMAR_FILL', vocab: 'VOCAB_FILL', kanji_reading: 'KANJI_READING', orthography: 'KANJI_WRITING', ordering: 'GRAMMAR_ORDER' };
const aicKindLabel = { grammar: '文法', vocab: '語彙', kanji_reading: '漢字読み', orthography: '表記', ordering: '並べ替え' };
for (const f of fs.readdirSync(R + '/aic/exercises').filter(f => /^jlpt-n[45]-/.test(f))) {
  const base = f.replace(/\.jsonl$/, '');
  const lines = fs.readFileSync(R + '/aic/exercises/' + f, 'utf8').split('\n').filter(Boolean);
  lines.forEach((l, i) => {
    const d = JSON.parse(l).data;
    if (!d || !d.choices) { rejected.push('AIC ' + base + '#' + (i + 1) + '：无选项（活用 drills 不收）'); return; }
    const expl = [d.explanation_en || d.explanation || ''];
    if (d.full_sentence) expl.push('完整句：' + d.full_sentence);
    if (d.translation_en) expl.push('英訳：' + d.translation_en);
    push(aicQs, {
      id: `aic-${base}-${String(i + 1).padStart(3, '0')}`,
      level: d.level,
      type: aicTypeMap[d.qtype] || 'GRAMMAR_FILL',
      prompt: String(d.question || '').trim(),
      choices: d.choices,
      answer: d.answer_index,
      explanation: expl.filter(Boolean).join('\n'),
      source: `${d.source || 'Tatoeba'}（CC BY 2.0 FR）${d.source_url ? ' ' + d.source_url : ''} · via Japanese-AI-Coach-bank（CC BY-SA 4.0）`,
      paper: `AI-Coach · ${d.level} ${aicKindLabel[d.qtype] || d.qtype}`,
    }, 'AIC');
  });
}
aicQs = verifyOrdering(aicQs, 'AIC');
fs.writeFileSync(OUT + '/bank-extra-aic.json', JSON.stringify({
  _license: 'CC BY-SA 4.0（署名-相同方式共享）。例句来自 Tatoeba（CC BY 2.0 FR），逐题 source 字段保留出处链接。',
  _source: 'https://github.com/Aymeric-Dcn/Japanese-AI-Coach-bank',
  questions: aicQs,
}, null, 1));

// ---------- JLPTSuccess（MIT，全部原创模拟） ----------
let jsQs = [];
const jsCatLabel = { moji: '文字・語彙', goi: '語彙', bunpou: '文法', dokkai: '読解' };
for (const lv of ['N4', 'N5']) {
  const dir = `${R}/js/${lv}/data`;
  const walk = d => fs.readdirSync(d).flatMap(f => {
    const p = d + '/' + f;
    return fs.statSync(p).isDirectory() ? walk(p) : [p];
  });
  if (fs.existsSync(dir + '/papers')) {
    for (const pf of walk(dir + '/papers').filter(f => f.endsWith('.json') && !f.endsWith('manifest.json'))) {
      const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
      const cat = p.category || pf.split('/papers/')[1].split('/')[0];
      const paperName = `JLPTSuccess · ${lv} ${jsCatLabel[cat] || cat} 模拟${p.paperNumber}`;
      for (const q of (p.questions || [])) {
        if (q.type !== 'mcq') { rejected.push('JS ' + q.id + '：papers 非 mcq（' + q.type + '）'); continue; }
        push(jsQs, {
          id: `js-${lv.toLowerCase()}-${q.id}`,
          level: lv,
          type: cat === 'bunpou' ? 'GRAMMAR_FILL' : cat === 'dokkai' ? 'SHORT_PASSAGE' : 'VOCAB_FILL',
          prompt: stripHtml(q.stem_html || q.stem || q.prompt).replace(/\s*\(n[1-5]-\d+\)/g, ''),
          choices: q.choices,
          answer: q.correctIndex,
          explanation: String(q.rationale || q.rationale_en || '').trim(),
          source: 'JLPTSuccess 原创模拟（gauravaccentureproducts/JLPTSuccess，MIT）',
          paper: paperName,
        }, 'JS');
      }
    }
  }
  if (fs.existsSync(dir + '/questions.json')) {
    const arr = JSON.parse(fs.readFileSync(dir + '/questions.json', 'utf8'));
    for (const q of (arr.questions || arr)) {
      const id = `js-${lv.toLowerCase()}-${q.id}`;
      if (q.type === 'mcq') {
        const ai = (q.choices || []).indexOf(q.correctAnswer);
        push(jsQs, {
          id, level: lv, type: 'GRAMMAR_FILL',
          prompt: stripHtml(q.question_ja || q.prompt_ja).replace(/\s*\(n[1-5]-\d+\)/g, ''),
          choices: q.choices, answer: ai,
          explanation: String(q.explanation_en || '').trim(),
          source: 'JLPTSuccess 原创练习（MIT）',
          paper: `JLPTSuccess · ${lv} 语法练习`,
        }, 'JS');
      } else if (q.type === 'sentence_order' && (q.tiles || []).length === 4 && (q.correctOrder || []).length === 4) {
        // 无 ★ 原题 → 固定 ★ 在第 2 位，答案 = 该位置词块在 tiles 中的下标
        const starTile = q.correctOrder[1];
        const ai = q.tiles.indexOf(starTile);
        push(jsQs, {
          id, level: lv, type: 'GRAMMAR_ORDER',
          prompt: '＿＿ ★ ＿＿ ＿＿',
          choices: q.tiles, answer: ai,
          explanation: ['正确语序：' + q.correctOrder.join(' → '), q.explanation_en || ''].filter(Boolean).join('\n'),
          source: 'JLPTSuccess 原创练习（MIT，★ 位置为转换时设定）',
          paper: `JLPTSuccess · ${lv} 语法练习`,
        }, 'JS');
      } else {
        rejected.push('JS ' + id + '：' + q.type + ' 无选项，不收');
      }
    }
  }
}
jsQs = verifyOrdering(jsQs, 'JS');
fs.writeFileSync(OUT + '/bank-extra-js.json', JSON.stringify({
  _license: 'MIT（内容随仓库许可证，作者声明全部原创、不抄真题）。',
  _source: 'https://github.com/gauravaccentureproducts/JLPTSuccess',
  questions: jsQs,
}, null, 1));

// ---------- 排序题 ★ 位置机械校验（解析声明的语序 vs answer） ----------
function verifyOrdering(list, label) {
  const bad = [];
  for (const q of list) {
    if (q.type !== 'GRAMMAR_ORDER') continue;
    const star = q.choices[q.answer];
    // ★ 是第几个空（数 ★ 左侧的 ＿ 组数，兼容 ＿＿/＿＿＿ 与 JS 的第 2 位★）
    const left = q.prompt.split('★')[0];
    const starIdx = (left.match(/＿+/g) || []).length;
    let order = null;
    const mArrow = q.explanation.match(/(?:Order|Ordre|正确语序)\s*[:：]\s*(.+)/);
    if (mArrow) order = mArrow[1].split('\n')[0].split('→').map(s => s.trim()).filter(Boolean);
    if (!order) {
      // OJ 风格：解析首句是空格分词的重组句 → 按整词 token 位置排序（避免 に/の 子串误配）
      const tokens = q.explanation.split('\n')[0].split(/\s+/);
      const pos = q.choices.map(c => ({ c, i: tokens.indexOf(c) })).filter(x => x.i >= 0);
      if (pos.length === 4 && new Set(pos.map(x => x.i)).size === 4)
        order = pos.sort((a, b) => a.i - b.i).map(x => x.c);
    }
    if (!order || order.length !== 4 || starIdx < 0 || starIdx > 3) continue; // 无法机械校验的不臆断
    const sameSet = [...order].sort().join('|') === [...q.choices].sort().join('|');
    if (!sameSet || order[starIdx] !== star) {
      bad.push(q.id);
      rejected.push(`${label} ${q.id}：★答案与解析语序矛盾（解析第${starIdx + 1}位=${order[starIdx]}，答案=${star}），疑似上游答案错误，拒收`);
    }
  }
  return list.filter(q => !bad.includes(q.id));
}

// ---------- 报告 ----------
const count = (list, f) => list.reduce((m, q) => (m[f(q)] = (m[f(q)] || 0) + 1, m), {});
console.log('OJ 入库', ojQs.length, JSON.stringify(count(ojQs, q => q.level)));
console.log('AIC 入库', aicQs.length, JSON.stringify(count(aicQs, q => q.level)));
console.log('JS 入库', jsQs.length, JSON.stringify(count(jsQs, q => q.level)));
console.log('拒收/跳过', rejected.length);
const byReason = {};
for (const r of rejected) { const m = r.split('：')[1] || '?'; byReason[m] = (byReason[m] || 0) + 1; }
console.log(JSON.stringify(byReason, null, 1));
fs.writeFileSync(R + '/rejected.log', rejected.join('\n'));
console.log('CONVERT_DONE');