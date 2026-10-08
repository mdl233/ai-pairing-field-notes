/**
 * search.mjs —— 检索核心（**零依赖、零平台**：只用 node 内置模块）
 *
 * 这一层的存在意义：**不绑定模型、不绑定 harness**。
 *   任何 agent（不管它是不是 DSH、支不支持 MCP）都能通过 `cli.mjs` 调它；
 *   DSH 插件和 MCP server 都只是它的**薄适配层**。
 *
 * 三轮迭代的结论都固化在这里（详见仓库台账 10.15）：
 *   ① **同义词展开是必须的** —— 用户的词常常不在文档里（"跑偏" vs "委托/判据/返工"）；
 *   ② **标题命中的权重要远高于正文**（正文只含字碎片会造成大量噪声）；
 *   ③ **正文命中也不能太轻** —— 答案常藏在正文里（"多了一层 f"只在正文出现）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYNONYMS } from './synonyms.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INDEX = path.join(HERE, 'index-data.json');

/** 读索引（可传别的路径，方便测试与多份笔记） */
export function loadIndex(file = DEFAULT_INDEX) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * 无检索价值的高频词 —— ★ 实测：查"完全不存在zzz"竟能搜出 8 条，
 * 因为 2-gram 里的"存在/完全"命中了正文。
 * ⚠️ 只收**真正没信息量**的词；"文件 / 路径 / 编码 / 端口"这类**技术词绝不能收**（它们是真的检索意图）。
 */
const STOP = new Set([
  '完全', '存在', '这个', '那个', '什么', '怎么', '就是', '已经', '但是', '因为',
  '所以', '这样', '那样', '时候', '问题', '方面', '情况', '地方', '东西', '事情',
  '应该', '可能', '需要', '进行', '通过', '关于', '对于', '以及', '并且', '或者',
  '一个', '一下', '一些', '不是', '没有', '可以', '如果', '而且', '然后', '现在',
]);

/** 查询 → 检索词集合（2-gram 切分 + 同义词展开） */
export function terms(query) {
  const q = String(query || '').toLowerCase().trim();
  const out = new Set();
  for (const w of q.split(/[\s,，、;；/|]+/).filter(Boolean)) out.add(w);

  const han = q.replace(/[^\u4e00-\u9fa5a-z0-9]+/g, '');
  for (let i = 0; i + 2 <= han.length; i++) out.add(han.slice(i, i + 2));

  for (const [k, vs] of Object.entries(SYNONYMS)) {
    if (q.includes(k)) for (const v of vs) out.add(v.toLowerCase());
  }
  return [...out].filter((t) => t.length >= 2 && !STOP.has(t));
}

/** 单条打分 */
export function score(item, ts, query = '') {
  const head = (item.title + ' ' + item.where).toLowerCase();
  const body = (item.text + ' ' + item.book).toLowerCase();
  let s = 0;
  for (const t of ts) {
    if (head.includes(t)) s += t.length >= 4 ? 6 : 3;
    else if (body.includes(t)) s += t.length >= 4 ? 1.5 : 0.8;
  }
  const q = String(query).toLowerCase().trim();
  if (q.length >= 3 && head.includes(q)) s += 8;
  else if (q.length >= 4 && body.includes(q)) s += 3;
  if (item.kind === '坑') s += 0.6;
  return s;
}

/** 排序取前 limit 条（默认 8：给 AI 用，多给几条让它自己挑） */
export function rank(items, query, limit = 8) {
  const ts = terms(query);
  if (!ts.length) return [];
  return items
    .map((it) => ({ it, s: score(it, ts, query) }))
    .filter((x) => x.s >= 2)   // ★ 阈值：滤掉"只靠一个 2-gram 正文命中"的噪声（那种多半无关）
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.min(Math.max(limit, 1), 12))
    .map((x) => x.it);
}

/** 一步到位：检索（可给现成的 data，省去重复读盘） */
export function search(query, { limit = 8, data, indexFile } = {}) {
  const d = data || loadIndex(indexFile);
  const hits = rank(d.items, query, limit);
  return { query: String(query), total: hits.length, generatedAt: d.generatedAt, source: d.source, hits };
}
