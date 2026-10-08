/**
 * rank.mjs —— 检索排序（纯函数，不依赖宿主，因此可以单独测：node test-rank.mjs）
 *
 * 三轮迭代的结论（都留在这里，免得下次又踩）：
 *   ① **同义词展开是必须的**：用户的词常常不在文档里（"跑偏" vs "委托/判据/返工"）⇒ 见 synonyms.mjs；
 *   ② **标题/出处的命中权重要远高于正文**：正文只含字碎片会造成大量噪声；
 *   ③ **正文命中也不能太轻**：很多问题的答案藏在正文里（例："多了一层 f"只在正文出现），
 *      所以正文权重给到 1.5，并给"整串短语命中正文"额外加成。
 */
import { SYNONYMS } from './synonyms.mjs';

/** 查询 → 检索词集合（含 2-gram 切分与同义词展开） */
export function terms(query) {
  const q = String(query || '').toLowerCase().trim();
  const out = new Set();
  for (const w of q.split(/[\s,，、;；/|]+/).filter(Boolean)) out.add(w);

  const han = q.replace(/[^\u4e00-\u9fa5a-z0-9]+/g, '');
  for (let i = 0; i + 2 <= han.length; i++) out.add(han.slice(i, i + 2));

  // ★ 同义词 / 意图展开
  for (const [k, vs] of Object.entries(SYNONYMS)) {
    if (q.includes(k)) for (const v of vs) out.add(v.toLowerCase());
  }
  return [...out].filter((t) => t.length >= 2);
}

/** 单条打分 */
export function score(item, ts, query = '') {
  const head = (item.title + ' ' + item.where).toLowerCase();
  const body = (item.text + ' ' + item.book).toLowerCase();
  let s = 0;
  for (const t of ts) {
    if (head.includes(t)) s += t.length >= 4 ? 6 : 3;          // 标题/出处命中：重
    else if (body.includes(t)) s += t.length >= 4 ? 1.5 : 0.8;  // 仅正文命中：轻，但不为零
  }
  const q = String(query).toLowerCase().trim();
  if (q.length >= 3 && head.includes(q)) s += 8;                 // 整串短语命中标题：强信号
  else if (q.length >= 4 && body.includes(q)) s += 3;            // 整串短语命中正文：也加分
  if (item.kind === '坑') s += 0.6;                             // 具体条目优先于章节
  return s;
}

/** 排序取前 limit 条（默认 8：这是给 AI 用的，多给几条让它自己挑） */
export function rank(items, query, limit = 8) {
  const ts = terms(query);
  if (!ts.length) return [];
  return items
    .map((it) => ({ it, s: score(it, ts, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.min(Math.max(limit, 1), 12))
    .map((x) => x.it);
}
