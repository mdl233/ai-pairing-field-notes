#!/usr/bin/env node
/**
 * install.mjs —— 把本插件装进某个 DSH profile
 *
 * ★ 它**只做三件事**：拷包 → 写 dependencies → 写 dsh.profile.bundles。
 * ★ 它**绝不重启宿主** —— 那一步必须由**人**来做（AI 不该、也不能替人重启）。
 *
 * 用法：
 *   node install.mjs                      # 自动找 profile（优先 desktop）
 *   node install.mjs --dry-run            # 只看会改什么，不落盘
 *   node install.mjs --profile <目录>      # 指定 profile
 *   node install.mjs --target <目录>       # 指定包放哪（默认 <profile>/plugins-local/...）
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry-run');
const HERE = import.meta.dirname;
const NAME = '@mdl233/pairing-notes';

function findProfile() {
  const explicit = getArg('--profile', '');
  if (explicit) return path.resolve(explicit);
  const base = path.join(os.homedir(), '.dsh', 'profiles');
  if (!fs.existsSync(base)) throw new Error(`找不到 profile 根目录：${base}`);
  const dirs = fs.readdirSync(base).filter((d) => fs.existsSync(path.join(base, d, 'package.json')));
  if (!dirs.length) throw new Error(`profiles 下没有含 package.json 的档案：${base}`);
  if (dirs.includes('desktop')) return path.join(base, 'desktop');
  if (dirs.length === 1) return path.join(base, dirs[0]);
  throw new Error(`有多个档案，请用 --profile 指定其一：${dirs.join(' / ')}`);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const profile = findProfile();
const pkgFile = path.join(profile, 'package.json');
if (!fs.existsSync(pkgFile)) throw new Error(`找不到 ${pkgFile}`);
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const target = path.resolve(getArg('--target', path.join(profile, 'plugins-local', '@mdl233', 'pairing-notes')));

pkg.dependencies ??= {};
pkg.dsh ??= {};
pkg.dsh.profile ??= {};
pkg.dsh.profile.bundles ??= [];

const depSpec = `file:${target.replace(/\\/g, '/')}`;
const alreadyDep = Object.prototype.hasOwnProperty.call(pkg.dependencies, NAME);
const alreadyBundle = pkg.dsh.profile.bundles.includes(NAME);

console.log('profile   :', profile);
console.log('包目录    :', target);
console.log('依赖写法  :', depSpec);
console.log('');
console.log(`① 拷包        : ${DRY ? '（dry-run 跳过）' : '执行'}`);
console.log(`② dependencies: ${alreadyDep ? '已存在 → 更新为上面这条' : '新增 ' + NAME}`);
console.log(`③ bundles     : ${alreadyBundle ? '已存在 → 跳过' : '追加 ' + NAME}`);

if (DRY) { console.log('\n（dry-run：未做任何修改）'); process.exit(0); }

// 备份 profile 的 package.json（改坏了能回去）
const bak = pkgFile + '.bak-pairing-notes';
fs.copyFileSync(pkgFile, bak);

copyDir(HERE, target);
// ★ 连带把仓库的 docs/ 拷进包 ⇒ 工具回报的"原文"会是**本地路径**（国内网络点不开 GitHub，模型却能直接读本地文件）
const docsSrc = path.join(HERE, '..', 'docs');
if (fs.existsSync(docsSrc)) {
  copyDir(docsSrc, path.join(target, 'docs'));
  console.log('④ 附带 docs : 已拷入 ' + path.join(target, 'docs'));
} else {
  console.log('④ 附带 docs : ⚠ 没找到 ' + docsSrc + '（工具会回落 GitHub 链接）');
}
pkg.dependencies[NAME] = depSpec;
if (!alreadyBundle) pkg.dsh.profile.bundles.push(NAME);
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 自检：写回后能解析、且字段在位
const check = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const ok = check.dependencies[NAME] && check.dsh.profile.bundles.includes(NAME);
console.log(`\n${ok ? '✅' : '⚠️'} 已写入（原文件备份 → ${path.basename(bak)}）`);
console.log('');
console.log('★ 还差最后一步 —— **请你自己重启 DSH**（这一步不作自动化）：');
console.log('   完全退出 DeepSeek Harness，再打开。');
console.log('   重启后问一句：「用 search_pairing_notes 查一下 cmd 中文乱码」验证。');
