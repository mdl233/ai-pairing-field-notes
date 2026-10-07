// verify-refs.mjs —— 检查文档里的"路径引用"是否真能打开（可复用）
// 用法: node verify-refs.mjs <md文件或目录...> [--json]
// 说明：只认以 _归档/审计/VM往返/手册/事故 开头的相对引用（基准 = DOCS_BASE 环境变量，默认当前目录），
//       反斜杠与正斜杠都认；打不开的逐条列出（可能是笔误，也可能是脚本自身解析问题）。
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.DOCS_BASE || process.cwd();
const argv = process.argv.slice(2);
const json = argv.includes('--json');
const inputs = argv.filter((a) => !a.startsWith('--'));
if (!inputs.length) { console.error('用法: node verify-refs.mjs <md/目录...> [--json]'); process.exit(2); }

const files = [];
const walk = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const f of fs.readdirSync(p)) walk(path.join(p, f)); }
  else if (/\.(md|json)$/i.test(p)) files.push(p);
};
for (const i of inputs) walk(i.replace(/\\/g, '/'));

// 抓 [_归档|审计|VM往返|手册|事故]/xxx.ext 形式的引用
// ⚠️ 只认以 _归档|审计|VM往返|手册|事故 开头的引用（= docs 相对）—— 这是刻意的：
//    放宽前缀会把 VM 视角(/media/…)、无盘符(\\dss\20-docs\…)、docs 相对 等「别的基准」一起抓进来，噪声更大
//   ⚠️ 长扩展名必须排在短的**前面**（jsonl 在 json 之前），否则 `.jsonl` 会被截成 `.json`
const SEG = '[^\\s`（）()）」|、，。；:：*<>"\'《》【】,;]+?';
const RE = new RegExp('(?:_归档|审计|VM往返|手册|事故)[\\\\/]' + SEG + '\\.(?:jsonl|md|json|txt|mjs|cjs|cmd|bat|png)', 'g');
const rows = [];
let total = 0, bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const seen = new Set();
  let m;
  while ((m = RE.exec(s))) {
    const raw = m[0].replace(/[。，；、]+$/, '');
    if (seen.has(raw)) continue;
    // 跳过"模式化写法"：花括号列表 {A.md,B.md} / 省略号简写（… 或 ...）/ 通配 / xxx 占位符 —— 它们不是具体路径
    if (/[{}…*]|\.\.\.|xxx/i.test(raw)) continue;
    seen.add(raw);
    const rel = raw.replace(/\\/g, '/');
    total++;
    // 引用有两种基准：① 文档目录相对（BASE）② 工作区根相对（BASE 的上两级）
    //   —— 例：`_归档\x.jsonl` 是相对工作区根写的，只按 BASE 找会误报"打不开"
    const viaBase = fs.existsSync(path.join(BASE, rel));
    const ok = viaBase || fs.existsSync(path.join(BASE, '..', '..', rel));
    if (!ok) bad++;
    rows.push({ file: f.replace(/\\/g, '/'), ref: raw, ok, via: viaBase ? 'docs' : (ok ? 'root' : '') });
  }
}
if (json) console.log(JSON.stringify({ total, bad, rows }, null, 1));
else {
  for (const r of rows.filter((x) => !x.ok)) console.log(`❌ ${r.file}\n     ${r.ref}`);
  console.log(`\n引用合计 ${total} 条，打不开 ${bad} 条${bad ? '' : '（全部可解析 ✅）'}`);
}
process.exit(bad ? 1 : 0);
