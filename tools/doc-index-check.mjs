#!/usr/bin/env node
/**
 * doc-index-check.mjs —— 文档索引体检（只读 · 零依赖）
 *
 * 解决的问题：一个几百上千篇 Markdown 的文档库，"索引"和"磁盘上的文件"很容易对不上 ——
 *   有人新写了文档但没人登记、索引指向已删的文件、目录索引与顶层索引不再互指、
 *   脚本产物落进了文档目录……这些都不是"写错一个字"，而是**会随时间无声累积**的问题；
 *   靠人翻是翻不出来的。
 *
 * 检查五类：
 *   ① 未登记 —— 磁盘有 .md，索引里没登记（红灯：待补索引）
 *   ② 悬空   —— 索引登记了，但磁盘上那个文件不存在（死链）
 *   ③ 互指   —— 目录索引 ↔ 顶层索引 是否**以路径形式**互指
 *   ④ 污染   —— 脚本产物落进了被登记的文档目录（红灯：该移走）
 *   ⑤ 豁免   —— 豁免清单（可选）的命中情况 + "僵尸条目"（写了豁免、但已不再需要）
 *
 * 用法：
 *   node doc-index-check.mjs --root <工作区根> [选项]
 *     --registry <rel>   登记表（默认 docs/README.md）
 *     --top-index <rel>  顶层索引（默认 README.md）
 *     --docs-dir <rel>   被检查的文档根（默认 docs）
 *     --allowlist <rel>  豁免清单，相对 root（默认 .doc-index-allowlist.txt，**允许不存在**）
 *     --no-exclude-self  不豁免索引文件自身（默认豁免 registry 与 top-index）
 *     --json             输出机器可读 JSON
 *   环境变量：DSS_ROOT 或 DOC_ROOT 可代替 --root
 *
 * 设计约束（这些是刻意的）：
 *   ❌ 不写任何文件（含临时文件）
 *   ❌ 不硬编码绝对路径（一切可配）
 *   ❌ 不引第三方依赖、不做 markdown AST 解析（正则够用，且不会因格式怪而崩）
 *   ❌ 不自动修复（只报告）
 *   ✅ 退出用 process.exitCode（不是 process.exit —— 后者会截断管道输出）
 *   ✅ 输出**必带覆盖度**（扫到 / 跳过 + 原因）—— 防止"什么都没扫到也算干净"
 *
 * 豁免清单格式（每行一条；路径与类别之间用**两个以上空格或 Tab**分隔）：
 *     相对 root 的路径     类别          理由
 *     例：docs/notes/wip.md   pollution   临时草稿，不该进索引
 *   类别里含 `pollution` 或 `清理` ⇒ 归入"污染"类；其余归"正常豁免"。
 *
 * 退出码：0 干净 ｜ 1 有告警 ｜ 2 用法/IO 错误
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const EXIT_OK = 0
const EXIT_WARN = 1
const EXIT_USAGE = 2

// ---------- 参数 ----------
function parseArgs(argv) {
  const o = {
    root: process.env.DSS_ROOT || process.env.DOC_ROOT || '',
    registry: 'docs/README.md',
    topIndex: 'README.md',
    docsDir: 'docs',
    allowlist: '.doc-index-allowlist.txt',
    excludeSelf: true,
    json: false,
  }
  const need = (i, name) => {
    if (i + 1 >= argv.length) { console.error(`参数 ${name} 缺少取值`); process.exit(EXIT_USAGE) }
    return argv[i + 1]
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--root') { o.root = need(i, a); i++ }
    else if (a === '--registry') { o.registry = need(i, a); i++ }
    else if (a === '--top-index') { o.topIndex = need(i, a); i++ }
    else if (a === '--docs-dir') { o.docsDir = need(i, a); i++ }
    else if (a === '--allowlist') { o.allowlist = need(i, a); i++ }
    else if (a === '--no-exclude-self') { o.excludeSelf = false }
    else if (a === '--json') { o.json = true }
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(EXIT_OK) }
    else { console.error(`未知参数: ${a}`); printUsage(); process.exit(EXIT_USAGE) }
  }
  return o
}

function printUsage() {
  console.log(`用法: node doc-index-check.mjs --root <工作区根> [选项]

  --root <dir>        工作区根（必填，或设环境变量 DSS_ROOT）
  --registry <rel>    登记表（默认 docs/README.md）
  --top-index <rel>   顶层索引（默认 README.md）
  --docs-dir <rel>    被检查的文档根（默认 docs）
  --allowlist <rel>   豁免清单，相对 root（默认 .doc-index-allowlist.txt，可不存在）
  --no-exclude-self   不豁免索引文件自身（默认豁免 registry 与 top-index）
  --json              输出机器可读 JSON

退出码: 0 干净 ｜ 1 有告警 ｜ 2 用法/IO 错误`)
}

// ---------- 工具 ----------
const toPosix = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
/** B12：POSIX 大小写敏感 / Windows 不敏感（不再无条件全小写） */
const CASE_INSENSITIVE = process.platform === 'win32'
const cmpKey = (p) => { const n = toPosix(p); return CASE_INSENSITIVE ? n.toLowerCase() : n }

/** 递归枚举 .md；B4：跳过项记入 skipped，不静默吞 */
function walkMd(dir, root, skipped, out) {
  let ents
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    skipped.push({ path: path.relative(root, dir) || '.', why: `readdir:${e.code || 'ERR'}` })
    return out
  }
  for (const e of ents) {
    const full = path.join(dir, e.name)
    const rel = path.relative(root, full)
    if (e.isSymbolicLink()) { skipped.push({ path: rel, why: 'symlink(未跟进)' }); continue }
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') { skipped.push({ path: rel, why: 'excluded' }); continue }
      walkMd(full, root, skipped, out)
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      out.push(rel)
    }
  }
  return out
}

/** B5/B6：处理锚点 / title / 尖括号 / %20 */
function extractLinks(text) {
  const out = []
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let t = m[1].trim()
    if (t.startsWith('<') && t.endsWith('>')) t = t.slice(1, -1).trim()
    t = t.split(/\s+["']/)[0]
    t = t.split('#')[0]
    try { t = decodeURIComponent(t) } catch { /* 保留原样 */ }
    if (t) out.push(t)
  }
  return out
}

const sha8 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8)
const exists = (p) => { try { return fs.existsSync(p) } catch { return false } }

/** B10：解析归类与理由，供僵尸回执与"污染"分类使用 */
function loadAllowlist(abs) {
  const entries = []
  if (!exists(abs)) return { entries, present: false }
  for (const line of fs.readFileSync(abs, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const parts = t.split(/\s{2,}|\t+/).map((x) => x.trim()).filter(Boolean)
    if (!parts.length) continue
    entries.push({ rel: parts[0], kind: parts[1] || '(未标)', reason: parts.slice(2).join(' ') || '(未写理由)' })
  }
  return { entries, present: true }
}

// ---------- 主流程 ----------
function run() {
  const o = parseArgs(process.argv.slice(2))
  if (!o.root) { console.error('缺少 --root（或环境变量 DSS_ROOT）'); printUsage(); process.exit(EXIT_USAGE) }

  const root = path.resolve(o.root)
  if (!exists(root)) { console.error(`root 不存在: ${root}`); process.exit(EXIT_USAGE) }

  const registryAbs = path.resolve(root, o.registry)
  const topAbs = path.resolve(root, o.topIndex)
  const docsAbs = path.resolve(root, o.docsDir)
  const allowAbs = path.resolve(root, o.allowlist)   // B9：相对 root（与其余参数一致）

  for (const [label, p] of [['registry', registryAbs], ['top-index', topAbs], ['docs-dir', docsAbs]]) {
    if (!exists(p)) { console.error(`${label} 不存在: ${p}`); process.exit(EXIT_USAGE) }
  }

  const skipped = []
  const onDisk = walkMd(docsAbs, root, skipped, [])

  // --- 登记表 ---
  const regText = fs.readFileSync(registryAbs, 'utf8')
  const regLinks = extractLinks(regText)
  const registered = new Set()
  const regRawForDangling = []
  for (const l of regLinks) {
    if (!l.toLowerCase().endsWith('.md')) continue
    const abs = path.resolve(path.dirname(registryAbs), l)
    registered.add(cmpKey(path.relative(root, abs)))
    regRawForDangling.push({ raw: l, abs })
  }

  // --- allowlist ---
  const al = loadAllowlist(allowAbs)
  const alByKey = new Map()
  for (const e of al.entries) alByKey.set(cmpKey(e.rel), e)

  // --- B3/B13：只豁免 registry 与 top-index 自身，可用 --no-exclude-self 关闭 ---
  const selfKeys = new Set()
  if (o.excludeSelf) {
    selfKeys.add(cmpKey(path.relative(root, registryAbs)))
    selfKeys.add(cmpKey(path.relative(root, topAbs)))
  }

  // --- ① 未登记 / ④ 污染 / ⑤ 豁免 ---
  const unregistered = []
  const pollution = []
  const usedAllow = new Set()
  let exemptCount = 0

  for (const rel of onDisk) {
    const k = cmpKey(rel)
    if (selfKeys.has(k)) continue
    if (registered.has(k)) continue
    const ae = alByKey.get(k)
    if (ae) {
      usedAllow.add(k)
      if (ae.kind.includes('清理') || ae.kind.toLowerCase().includes('pollution')) pollution.push({ rel, reason: ae.reason })
      else exemptCount++
      continue
    }
    unregistered.push(rel)
  }

  // B10：僵尸 = allowlist 有、但已不再处于"未登记"状态
  const zombies = []
  for (const e of al.entries) {
    if (!usedAllow.has(cmpKey(e.rel))) zombies.push({ rel: e.rel, kind: e.kind })
  }

  // --- ② 悬空（B7 去重）---
  const seen = new Set()
  const dangling = []
  for (const d of regRawForDangling) {
    if (exists(d.abs)) continue
    const k = cmpKey(d.raw)
    if (seen.has(k)) continue
    seen.add(k)
    dangling.push(d.raw)
  }

  // --- ③ 互指（B2：路径级，不是文件名级）---
  const regRel = toPosix(path.relative(root, registryAbs))
  const topRel = toPosix(path.relative(root, topAbs))
  const topText = fs.readFileSync(topAbs, 'utf8')
  const mutual = []
  if (!toPosix(topText).includes(regRel)) mutual.push(`${path.basename(topAbs)} 未以路径形式提及 ${regRel}`)
  if (!toPosix(regText).includes(topRel)) mutual.push(`${path.basename(registryAbs)} 未以路径形式提及 ${topRel}`)

  // --- 结果 ---
  // 自洽口径：只统计【落在扫描范围内的】索引自身
  //   （top-index 常在根目录，不在 docs-dir 下，算进去会导致合计 > 磁盘）
  const selfInScope = [...selfKeys].filter((k) => onDisk.some((r) => cmpKey(r) === k)).length
  const accounted = registered.size + unregistered.length + pollution.length + exemptCount + selfInScope
  const counts = {
    onDisk: onDisk.length,
    registered: registered.size,
    skipped: skipped.length,
    unregistered: unregistered.length,
    dangling: dangling.length,
    mutual: mutual.length,
    pollution: pollution.length,
    exempt: exemptCount,
    zombies: zombies.length,
    selfExcluded: selfInScope,
    accounted,
  }
  const clean = counts.unregistered === 0 && counts.dangling === 0 && counts.mutual === 0
    && counts.pollution === 0 && counts.zombies === 0

  const result = {
    source: root,
    registry: { path: regRel, sha8: sha8(regText), mtime: fs.statSync(registryAbs).mtime.toISOString() },
    topIndex: { path: topRel, mtime: fs.statSync(topAbs).mtime.toISOString() },
    allowlist: { path: toPosix(path.relative(root, allowAbs)), present: al.present, entries: al.entries.length, used: usedAllow.size },
    counts,
    coverage: { scanned: onDisk.length, skipped: skipped.length, skippedDetail: skipped },
    unregistered: [...unregistered].sort(),
    dangling: [...dangling].sort(),
    mutual,
    pollution: [...pollution].sort((a, b) => a.rel.localeCompare(b.rel)),
    zombies: [...zombies].sort((a, b) => a.rel.localeCompare(b.rel)),
    clean,
  }

  // ---------- 输出（B1：不调 process.exit）----------
  let text
  if (o.json) {
    text = JSON.stringify(result, null, 2)
  } else {
    const L = []
    L.push(`SOURCE: ${root}`)
    L.push(`REGISTRY: ${regRel} (sha256:${result.registry.sha8}) ｜ MTIME: ${result.registry.mtime}`)
    L.push(`TOP-INDEX: ${topRel} ｜ MTIME: ${result.topIndex.mtime}`)
    L.push('')
    // B14：自洽分解式
    L.push(`① 未登记 ${counts.unregistered} 个（红灯：待补索引）`)
    L.push(`     磁盘 ${counts.onDisk} = 登记 ${counts.registered} + 未登记 ${counts.unregistered} + 污染 ${counts.pollution} + 豁免 ${counts.exempt} + 索引自身 ${counts.selfExcluded} = ${accounted}${accounted === counts.onDisk ? ' ✓自洽' : ' ⚠不自洽（有文件同时命中多类或漏判）'}`)
    for (const x of result.unregistered) L.push(`     - ${x}`)
    L.push(`② 悬空   ${counts.dangling} 个`)
    for (const x of result.dangling) L.push(`     - ${x}`)
    L.push(`③ 互指   ${counts.mutual === 0 ? 'OK' : 'MISSING'}`)
    for (const x of mutual) L.push(`     - ${x}`)
    L.push(`④ 污染   ${counts.pollution} 个（脚本产物，应移出登记目录）`)
    for (const x of result.pollution) L.push(`     - ${x.rel}  ← ${x.reason}`)
    L.push(`⑤ 豁免   ${counts.exempt} 个 ｜ 僵尸条目 ${counts.zombies} 个`)
    for (const x of result.zombies) L.push(`     ⚠ 僵尸: ${x.rel} → 可从 allowlist 删除`)
    L.push('')
    L.push(`覆盖：扫到 ${counts.onDisk} 个 .md ｜ 跳过 ${counts.skipped} 个`)
    for (const s of skipped) L.push(`     - ${s.path}（${s.why}）`)
    L.push(`ALLOWLIST: ${result.allowlist.path}${al.present ? `（条目 ${al.entries.length}，命中 ${usedAllow.size}）` : '（不存在）'}`)
    L.push(`结果：${clean ? '干净' : '有告警'}`)
    text = L.join('\n')
  }

  process.stdout.write(text + '\n', () => { process.exitCode = clean ? EXIT_OK : EXIT_WARN })
}

run()
