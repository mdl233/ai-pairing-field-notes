#!/usr/bin/env node
/**
 * verify-utf8.mjs —— **全文** UTF-8 合法性校验（补 delivery_check 的 64KB 切片误报）
 *
 * 为什么需要它：
 *   `delivery_check` 的 encoding-utf8 检查按**固定 64KB 切片**解码；若切点落在多字节汉字内部，
 *   会报 `The encoded data was not valid for encoding utf-8` —— 而文件其实完全合法。
 *   2026-09-21 实测复现两次（切点分别为 `0x8a` 续字节与 `0xe6` 首字节；同期全文严格解码 OK）。
 *   ⇒ 大文件（>64KB 且含中文）遇到该 FAIL 时，**先跑本脚本反证**，不要改文件去凑字节边界。
 *
 * 用法：
 *   node verify-utf8.mjs <file...> [--json]
 *
 * 退出码：
 *   0 = 全部文件为合法 UTF-8（无 BOM 警告时也返回 0，BOM 只作为提示）
 *   1 = 至少一个文件非法（非法字节序列 / 读失败）
 *   2 = 用法错误
 *
 * 检查项：
 *   ① 全文严格解码（TextDecoder fatal）—— 与切片无关，是真判据
 *   ② BOM 检测（EF BB BF；本仓库规范要求 .md/.json/.mjs 无 BOM）
 *   ③ 替换字符 U+FFFD 计数（合法 UTF-8 但内容可能是坏字符，值得人工看一眼）
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('用法: node verify-utf8.mjs <file...> [--json]');
  process.exit(2);
}

const dec = new TextDecoder('utf-8', { fatal: true });
const rows = [];
let bad = 0;

for (const f of files) {
  let buf;
  try {
    buf = fs.readFileSync(f);
  } catch (e) {
    rows.push({ file: f, ok: false, error: `READ_FAIL: ${e.code ?? e.message}` });
    bad++;
    continue;
  }
  const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  let ok = true, why = null, chars = null, fffd = null;
  try {
    const text = dec.decode(buf);
    chars = text.length;
    fffd = (text.match(/\uFFFD/g) || []).length;
  } catch (e) {
    ok = false; why = e.message;
  }
  if (!ok) bad++;
  rows.push({ file: f, bytes: buf.length, ok, bom, chars, replacementChars: fffd, why });
}

if (json) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  for (const r of rows) {
    if (r.error) { console.log(`❌ ${r.file}\n   ${r.error}`); continue; }
    const flags = [
      `${r.bytes} 字节`,
      `${r.chars} 字符`,
      r.bom ? '⚠️ 含 BOM' : '无 BOM',
      r.replacementChars ? `⚠️ U+FFFD ×${r.replacementChars}` : null,
    ].filter(Boolean).join(' / ');
    console.log(`${r.ok ? '✅' : '❌'} ${r.file}\n   ${flags}${r.why ? `\n   原因: ${r.why}` : ''}`);
  }
  console.log(`\n${bad ? `❌ ${bad} 个文件非法` : `✅ 全部 ${rows.length} 个文件为合法 UTF-8（全文校验，与 64KB 切片无关）`}`);
}
process.exit(bad ? 1 : 0);
