#!/usr/bin/env node
/**
 * sanitize-check.mjs —— 导出/开源前的**脱敏检查与替换**（可公开的通用工具）
 *
 * 设计要点：**脚本本体不含任何真实凭证或本机标识** ——
 *   内置的只是"凭证形态"模式（如 `sk-` 开头的 key、密码赋值写法），
 *   具体的字面量（主机名 / 用户名 / 密码 / 本机绝对路径）从 `--targets` 指向的
 *   本地 JSON 读取，而那个文件**不进导出包**。
 *
 * 用法：
 *   node sanitize-check.mjs --check <路径...> [--targets <json>] [--json]
 *   node sanitize-check.mjs --apply <源（文件|目录）> <目标目录> [--targets <json>]
 *
 * targets JSON 结构：
 *   {
 *     "rules": [
 *       { "name": "主机名",   "find": "某主机名",        "to": "<主机名>" },
 *       { "name": "工作区",   "find": "/^[A-Z]:\\\\path/i", "to": "<工作区>" }
 *     ]
 *   }
 *   `find` 以 `/` 开头结尾时按**正则字面量**解析（g 标志自动补），否则按**字面量**处理。
 *
 * 退出码：0 = 干净（无命中）；1 = 有命中；2 = 用法/读取错误。
 */
import fs from 'node:fs';
import path from 'node:path';

// ── 内置通用模式：只看"形态"，不含具体值 ─────────────────────────────
const BUILTIN = [
  ['API key（sk- 风格）', /sk-[A-Za-z0-9_-]{16,}/g, '<REDACTED-KEY>'],
  ['API key（32hex.base62 风格）', /\b[0-9a-f]{32}\.[A-Za-z0-9]{16,}\b/g, '<REDACTED-KEY>'],
  ['Bearer 令牌', /Bearer\s+[A-Za-z0-9._-]{20,}/g, 'Bearer <REDACTED>'],
  ['密码赋值', /((?:password|passwd|pwd|secret|token)\s*[:=]\s*)(["']?)(?!<REDACTED>)[^\s"',;]{6,}\2/gi, '$1<REDACTED>'],
  ['私钥块', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '<REDACTED-PRIVATE-KEY>'],
];

const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.venv', 'dist', 'build']);
const TEXT_EXT = new Set(['.md', '.txt', '.json', '.mjs', '.cjs', '.js', '.ts', '.yml', '.yaml', '.cmd', '.bat', '.ps1', '.sh', '.html', '.css', '.csv', '.log', '.ini', '.conf', '.toml']);

const argv = process.argv.slice(2);
const mode = argv.includes('--apply') ? 'apply' : argv.includes('--check') ? 'check' : null;
const asJson = argv.includes('--json');
const pick = (flag) => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; };
const targetsFile = pick('--targets');
if (!mode) { console.error('用法: node sanitize-check.mjs --check <路径...> | --apply <源> <目标目录> [--targets <json>]'); process.exit(2); }

// ── 装载规则 ─────────────────────────────────────────────────────────
function loadExternalTargets(file) {
  if (!file) return [];
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { console.error(`✗ 读不到 targets 文件: ${file} (${e.code})`); process.exit(2); }
  const data = JSON.parse(raw);
  return (data.rules || []).map((r) => {
    const f = String(r.find ?? '');
    // findEnv：值从环境变量取，**规则文件里不落明文**
    if (r.findEnv) {
      const v = process.env[r.findEnv];
      if (!v) { console.error(`✗ 规则「${r.name || r.findEnv}」需要环境变量 ${r.findEnv}（当前未设置）`); process.exit(2); }
      return [r.name || r.findEnv, new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), r.to ?? '<REDACTED>'];
    }
    // 仅当形如 /pattern/ 或 /pattern/flags（flags 只含 gimsuy）时按正则解析；
    // 否则一律按字面量 —— 否则像 "/some/dir" 这样的普通路径会被误判成正则。
    const isRe = f.length > 2 && f.startsWith('/') && /\/(?:g|i|m|s|u|y)*$/.test(f);
    let re;
    if (isRe) {
      const end = f.lastIndexOf('/');
      re = new RegExp(f.slice(1, end), (f.slice(end + 1).includes('g') ? '' : 'g') + f.slice(end + 1));
    } else {
      re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    }
    return [r.name || f, re, r.to ?? '<REDACTED>'];
  });
}

const RULES = [...loadExternalTargets(targetsFile), ...BUILTIN];

// ── 扫描 / 替换 ──────────────────────────────────────────────────────
function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) {
      if (SKIP_DIRS.has(name)) continue;
      walk(path.join(p, name), out);
    }
  } else if (TEXT_EXT.has(path.extname(p).toLowerCase())) {
    out.push(p);
  }
  return out;
}

function sanitizeText(text) {
  const hits = [];
  for (const [name, re, to] of RULES) {
    re.lastIndex = 0;
    const found = text.match(re);
    if (found && found.length) {
      hits.push({ name, count: found.length, sample: String(found[0]).slice(0, 24) + (String(found[0]).length > 24 ? '…' : '') });
      re.lastIndex = 0;
      text = text.replace(re, to);
    }
  }
  return { text, hits };
}

function scanOnly(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = [];
  for (const [name, re] of RULES) {
    re.lastIndex = 0;
    let m, n = 0, firstLine = 0, sample = '';
    while ((m = re.exec(text)) !== null) {
      n++;
      if (n === 1) { firstLine = text.slice(0, m.index).split('\n').length; sample = m[0].slice(0, 24); }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    if (n) rows.push({ name, count: n, firstLine, sample });
  }
  return rows;
}

// ── 主流程 ───────────────────────────────────────────────────────────
if (mode === 'check') {
  const paths = argv.filter((a) => !a.startsWith('--') && a !== targetsFile);
  if (!paths.length) { console.error('--check 需要至少一个路径'); process.exit(2); }
  const files = paths.flatMap((p) => walk(p));
  let totalHits = 0;
  const report = [];
  for (const f of files) {
    const rows = scanOnly(f);
    if (rows.length) { totalHits += rows.reduce((s, r) => s + r.count, 0); report.push({ file: f, rows }); }
  }
  if (asJson) {
    console.log(JSON.stringify({ mode: 'check', files: files.length, totalHits, report }, null, 2));
  } else {
    console.log(`规则数 ${RULES.length} ｜ 扫描 ${files.length} 个文本文件`);
    for (const r of report) {
      console.log(`\n❌ ${r.file}`);
      for (const row of r.rows) console.log(`   · ${row.name} ×${row.count}（首处 L${row.firstLine}: ${row.sample}…）`);
    }
    console.log(totalHits ? `\n✗ 命中 ${totalHits} 处 —— 不允许导出，先脱敏` : `\n✓ 干净：0 命中`);
  }
  process.exit(totalHits ? 1 : 0);
}

if (mode === 'apply') {
  const [src, dst] = argv.slice(argv.indexOf('--apply') + 1).filter((a) => !a.startsWith('--') && a !== targetsFile);
  if (!src || !dst) { console.error('用法: --apply <源> <目标目录>'); process.exit(2); }
  const files = walk(src);
  const log = [];
  for (const f of files) {
    const srcText = fs.readFileSync(f, 'utf8');
    const { text, hits } = sanitizeText(srcText);
    const rel = path.relative(fs.statSync(src).isDirectory() ? src : path.dirname(src), f);
    const out = path.join(dst, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, 'utf8');
    log.push({ file: rel, hits });
  }
  const total = log.reduce((s, l) => s + l.hits.reduce((a, h) => a + h.count, 0), 0);
  console.log(`已写出 ${log.length} 个文件 → ${dst}（替换 ${total} 处）`);
  for (const l of log) if (l.hits.length) console.log(`  ${l.file}: ` + l.hits.map((h) => `${h.name}×${h.count}`).join(', '));
  // 自检：对写出结果再扫一遍
  let left = 0;
  for (const f of walk(dst)) left += scanOnly(f).reduce((s, r) => s + r.count, 0);
  console.log(left ? `⚠️ 写出后仍有 ${left} 处命中（可能是 targets 未覆盖的形态，请人工核对）` : `✓ 写出后自检：0 命中`);
  process.exit(0);
}
