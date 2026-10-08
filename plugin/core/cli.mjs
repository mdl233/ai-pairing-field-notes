#!/usr/bin/env node
/**
 * cli.mjs —— ★ 通用入口：**任何 agent / 任何平台**都能用它
 *
 * 设计前提：**不绑定模型、不绑定 harness** ——
 *   只要那台机器有 node，就能 `node core/cli.mjs search "..."`，
 *   不必支持 MCP、不必是 DSH、不必装任何插件。
 *
 * 用法：
 *   node core/cli.mjs search "cmd 中文乱码" [--limit 8] [--json]
 *   node core/cli.mjs workflows [--json]           # 列出可用工作流
 *   node core/cli.mjs workflow <名字> [--json]      # 取一个工作流的步骤
 *   node core/cli.mjs index [--json]               # 索引概况
 *   node core/cli.mjs --help
 *
 * 退出码：0 正常 ｜ 1 无命中 ｜ 2 用法错误
 */
import { search, loadIndex } from './search.mjs';
import { listWorkflows, getWorkflow } from './workflows.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const JSON_OUT = has('--json');
const cmd = argv[0];

function out(obj, text) {
  if (JSON_OUT) console.log(JSON.stringify(obj, null, 2));
  else console.log(text);
}

function help() {
  console.log(`pairing-notes · 通用笔记检索（不绑定模型 / 不绑定 harness）

用法:
  node core/cli.mjs search "<问题或关键词>" [--limit N] [--json]
  node core/cli.mjs workflows [--json]
  node core/cli.mjs workflow "<工作流名>" [--json]
  node core/cli.mjs index [--json]

说明:
  · 默认输出给人 / 模型看的纯文本；加 --json 输出机读结果。
  · exit 0=正常 · 1=无命中 · 2=用法错误`);
}

if (!cmd || cmd === '--help' || cmd === '-h') { help(); process.exit(cmd ? 0 : 2); }

if (cmd === 'search') {
  const query = argv[1];
  if (!query || query.startsWith('--')) { console.error('缺少查询词。例：node core/cli.mjs search "cmd 中文乱码"'); process.exit(2); }
  const limit = Number(opt('--limit', 8));
  const r = search(query, { limit });
  if (!r.hits.length) { out(r, `没有命中：${query}`); process.exit(1); }
  const text = [
    `命中 ${r.total} 条（查询：${query}）：`,
    '',
    ...r.hits.map((h, i) => `${i + 1}. 【${h.no} ${h.book}】${h.title}\n   ↳ ${h.where}\n   ↳ docs/${h.file}`),
  ].join('\n');
  out(r, text);
  process.exit(0);
}

if (cmd === 'workflows') {
  const ws = listWorkflows();
  if (!ws.length) { console.log('（还没定义工作流）'); process.exit(1); }
  out(ws, ['可用工作流：', '', ...ws.map((w) => `· ${w.name} —— ${w.when}`)].join('\n'));
  process.exit(0);
}

if (cmd === 'workflow') {
  const name = argv[1];
  if (!name) { console.error('缺少工作流名。先跑：node core/cli.mjs workflows'); process.exit(2); }
  const w = getWorkflow(name);
  if (!w) { console.error(`没有这个工作流：${name}`); process.exit(1); }
  const text = [
    `# ${w.name}`,
    '',
    `**什么时候用**：${w.when}`,
    '',
    '**步骤**：',
    ...w.steps.map((s, i) => `${i + 1}. ${s.do}${s.check ? `\n   · 判据：${s.check}` : ''}${s.from ? `\n   · 出处：${s.from}` : ''}`),
    w.pitfalls?.length ? `\n**常见翻车**：\n${w.pitfalls.map((p) => `· ${p}`).join('\n')}` : '',
  ].join('\n');
  out(w, text);
  process.exit(0);
}

if (cmd === 'index') {
  const d = loadIndex();
  const r = { generatedAt: d.generatedAt, source: d.source, counts: d.counts, total: d.items.length };
  out(r, [`索引生成于 ${d.generatedAt}`, `来源 ${d.source}`, `速查 ${d.counts.items} 条 ＋ 章节 ${d.counts.chapters} 条 ＝ ${d.items.length} 条`].join('\n'));
  process.exit(0);
}

console.error(`未知命令：${cmd}\n`);
help();
process.exit(2);
