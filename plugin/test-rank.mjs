#!/usr/bin/env node
/**
 * test-rank.mjs —— 用**真实问题**测检索质量（不需要宿主，直接跑排序纯函数）
 *
 * 判据（三轮迭代后定的）：
 *   · 这个工具是**给 AI 用的** —— AI 拿到前几条候选后会自己判断，所以判据是
 *     **「期望的篇号出现在前 5 条里」**，而不是"第 1 条必须完美"；
 *   · 期望值按**文档实际写了什么**校准（例：讲长会话纪律的是 `01` 的 `I12`，
 *     而不是我以为的 `06 §5` —— 这种"期望本身写错"会让测试虚低）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { rank } from './lib/rank.mjs';

const DATA = path.join(import.meta.dirname, 'lib', 'index-data.json');
if (!fs.existsSync(DATA)) { console.error('✗ 先跑 build-index.mjs 生成 lib/index-data.json'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));

// 【查询, 期望命中的篇号（任一即可）】
const CASES = [
  ['cmd 里中文乱码', ['01']],
  ['报编码错但文件明明是好的', ['01']],
  ['路径里凭空多了一层 f', ['02']],
  ['删 junction 把真身也删了', ['01', '02']],
  ['AI 老跑偏、答不到点上', ['03']],
  ['评审改到停不下来', ['03']],
  ['下载 401 超时要登录', ['05', '01']],
  ['大文件下完打不开', ['05', '01']],
  ['出图崩手', ['04', '01']],
  ['跑图时电脑卡死', ['04', '01']],
  ['会话变慢上下文很贵', ['06', '01']],
  ['担心结论丢掉', ['06']],
  ['误删了文件回不去', ['06']],
  ['插件装了没生效', ['01', '05']],
];

let pass = 0;
console.log(`索引：${data.counts.items} 条速查 ＋ ${data.counts.chapters} 条章节 ＝ ${data.items.length}（生成于 ${data.generatedAt}）`);
console.log(`判据：期望篇号出现在【前 5 条】里即算命中（给 AI 用 —— 它拿到候选后自己挑）\n`);
for (const [q, expect] of CASES) {
  const hits = rank(data.items, q, 8);
  const ok = hits.slice(0, 5).some((h) => expect.includes(h.no));
  if (ok) pass++;
  console.log(`${ok ? '✅' : '❌'} 「${q}」  期望篇号 ${expect.join('/')}`);
  hits.slice(0, 3).forEach((h, i) => console.log(`     ${i + 1}. [${h.no}] ${h.title}  → ${h.where}`));
  if (!hits.length) console.log('     （无命中）');
}
console.log(`\n前 5 条含期望篇号：${pass}/${CASES.length}`);
