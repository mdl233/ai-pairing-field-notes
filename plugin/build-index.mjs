#!/usr/bin/env node
/**
 * build-index.mjs —— 从 docs/ 生成插件用的检索索引（lib/index-data.json）
 *
 * 为什么要索引而不是内置全文：
 *   · 全文 ~250 KB，装进包里会让插件变重、且每次改笔记都要重发；索引小、可随时重建。
 *   · AI 需要的是"先找到是哪条、哪一篇"，再去看原文 —— 索引正好给这一跳。
 *
 * 索引来源（按优先级）：
 *   ① 01 篇的「§一 速查表」—— 天然就是"现象 → 条目"表（最有用）
 *   ② 六篇的章节目录（## 级）—— 用来回答"这类问题看哪篇"
 *
 * 用法：node build-index.mjs [--docs <目录>] [--out <文件>]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DOCS = path.resolve(getArg('--docs', path.join(import.meta.dirname, '..', 'docs')));
const OUT = path.resolve(getArg('--out', path.join(import.meta.dirname, 'lib', 'index-data.json')));

const META = {
  '01-windows-chinese-dev-pitfalls.md': { no: '01', title: '避坑手册', kind: '坑' },
  '02-getting-started-with-ai-pairing.md': { no: '02', title: '从零开始', kind: '入门' },
  '03-discipline-of-pairing-with-ai.md': { no: '03', title: '跟 AI 协作的纪律', kind: '纪律' },
  '04-ai-ui-and-art-pipeline.md': { no: '04', title: '让 AI 做界面与美术', kind: '界面' },
  '05-getting-resources-in-china.md': { no: '05', title: '在国内网络里搞到资源', kind: '资源' },
  '06-keeping-the-work.md': { no: '06', title: '把工作留下来的做法', kind: '留存' },
};

const items = [];
const chapters = [];

for (const [file, meta] of Object.entries(META)) {
  const p = path.join(DOCS, file);
  if (!fs.existsSync(p)) { console.error('✗ 缺少文件: ' + file); process.exit(1); }
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/);

  // ① 速查表：| 现象 | 条目 |
  let inTable = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inTable = /速查表/.test(line);
      continue;
    }
    if (!inTable) continue;
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/);
    if (!m || /^[-: ]+$/.test(m[1]) || /现象|症状|看到|简表/.test(m[1])) continue;
    const symptom = m[1].replace(/[*`]/g, '').trim();
    const target = m[2].replace(/[*`]/g, '').trim();
    if (!symptom || !target || symptom.length < 4) continue;
    items.push({ file, no: meta.no, book: meta.title, kind: '坑', title: symptom, where: target, text: `${symptom} → ${target}` });
  }

  // ② 章节（## 级）与小节（### 级）—— ★ 小节必须收：03~06 的内容全在 ### 里
  lines.forEach((line, i) => {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) return;
    const title = m[2].replace(/[*`]/g, '').trim();
    if (/速查表|维护规则|一页速查|^目录$/.test(title)) return;
    const kind = m[1] === '###' ? '节' : '章';
    // 取该章后第一段非空、非标题的文字作摘要
    // ★ 摘要取该小节后 500 字（去掉表格/引用/标题）—— 只取首段会让"正文里的说法"检索不到
    const parts = [];
    for (let j = i + 1; j < Math.min(i + 60, lines.length) && parts.join('').length < 500; j++) {
      const t = lines[j].trim();
      if (!t || t.startsWith('|') || t.startsWith('>') || t.startsWith('#') || t.startsWith('---')) continue;
      parts.push(t.replace(/[*`>]/g, ''));
    }
    const summary = parts.join(' ').slice(0, 500);
    chapters.push({ file, no: meta.no, book: meta.title, kind, title, where: title, text: `${meta.title} · ${title}${summary ? ' — ' + summary : ''}` });
  });
}

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: 'github.com/mdl233/ai-pairing-field-notes',
  counts: { items: items.length, chapters: chapters.length },
  items: [...items, ...chapters],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data), 'utf8');   // 不缩进：索引是给程序读的，缩进只会让体积和 diff 变大
console.log(`✔ 索引已生成 → ${OUT}`);
console.log(`  速查条目 ${items.length} 条 ｜ 章节 ${chapters.length} 条 ｜ 合计 ${data.items.length}`);
