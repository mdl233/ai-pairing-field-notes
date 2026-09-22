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
const RE = /(?:_归档|审计|VM往返|手册|事故)[\\/][^\s`）」|、，。；:：*<>"']+?\.(?:md|json|txt|mjs|cjs|cmd|bat|png)/g;
const rows = [];
let total = 0, bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const seen = new Set();
  let m;
  while ((m = RE.exec(s))) {
    const raw = m[0].replace(/[。，；、]+$/, '');
    if (seen.has(raw)) continue;
    // 跳过"模式化写法"：花括号列表 {A.md,B.md} / 省略号简写 审计\77-… / 通配 —— 它们不是具体路径
    if (/[{}…*]/.test(raw)) continue;
    seen.add(raw);
    const rel = raw.replace(/\\/g, '/');
    total++;
    const abs = path.join(BASE, rel);
    const ok = fs.existsSync(abs);
    if (!ok) bad++;
    rows.push({ file: f.replace(/\\/g, '/'), ref: raw, ok });
  }
}
if (json) console.log(JSON.stringify({ total, bad, rows }, null, 1));
else {
  for (const r of rows.filter((x) => !x.ok)) console.log(`❌ ${r.file}\n     ${r.ref}`);
  console.log(`\n引用合计 ${total} 条，打不开 ${bad} 条${bad ? '' : '（全部可解析 ✅）'}`);
}
process.exit(bad ? 1 : 0);
