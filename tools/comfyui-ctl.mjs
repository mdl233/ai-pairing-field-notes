#!/usr/bin/env node
/**
 * comfyui-ctl.mjs —— ComfyUI 幂等启停（status / start / stop）
 *
 * 用法：
 *   node comfyui-ctl.mjs status | start | stop
 *        [--root <ComfyUI 根目录>] [--url http://127.0.0.1:8188]
 *
 * 环境变量（命令行参数优先）：
 *   COMFYUI_ROOT   ComfyUI 根目录（里面应有 python_embeded\python.exe 与 ComfyUI\main.py）
 *   COMFYUI_URL    服务地址，默认 http://127.0.0.1:8188
 *
 * 两个来自实战的设计：
 *   ① **启动不经 cmd**，直接调 python_embeded —— 用 `cmd /c start` 启动，每启一次就多一个窗口，
 *      反复启动会堆一串窗口。
 *   ② **加 `--disable-auto-launch`** —— 否则每次启动都会自动打开一个浏览器标签页，同样会越堆越多。
 *
 * ⚠️ 一条**状态判断的局限**（很重要）：
 *   `status` 只能证明"服务在不在响应"。**进程已僵死但仍占着显存**时，它可能报"没在跑"。
 *   ⇒ 跑图前请**交叉验证**一次：
 *      nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv
 */
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const cmd = (argv.find((a) => !a.startsWith('--')) || 'status').toLowerCase();
const opt = (name, env, fallback) => {
  const i = argv.indexOf('--' + name);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  return process.env[env] || fallback;
};

const ROOT = opt('root', 'COMFYUI_ROOT', '');
const BASE = opt('url', 'COMFYUI_URL', 'http://127.0.0.1:8188').replace(/\/$/, '');
const PORT = (BASE.match(/:(\d+)/) || [])[1] || '8188';

if (!ROOT) {
  console.error('缺 ComfyUI 根目录：用 --root <目录> 或设环境变量 COMFYUI_ROOT');
  process.exit(2);
}
const PY = path.join(ROOT, 'python_embeded', 'python.exe');
const PIDFILE = path.join(ROOT, '.comfyui.pid');
const PS = 'powershell -NoProfile -Command';
const ARGS = ['-s', path.join('ComfyUI', 'main.py'), '--windows-standalone-build', '--disable-auto-launch'];

async function probe() {
  try {
    const r = await fetch(BASE + '/system_stats', { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    const dev = (j.devices || [])[0] || {};
    return { up: true, vram_free_mb: Math.round((dev.vram_free || 0) / 1048576) };
  } catch {
    return { up: false };
  }
}

function listeningPids() {
  try {
    const out = execSync(
      `${PS} "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: 'utf8' });
    return out.split(/\s+/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
  } catch {
    return [];
  }
}

function readPid() {
  try {
    return existsSync(PIDFILE) ? parseInt(readFileSync(PIDFILE, 'utf8').trim(), 10) || 0 : 0;
  } catch {
    return 0;
  }
}

const st = await probe();

if (cmd === 'status') {
  console.log(st.up
    ? `✅ 在跑（显存空闲 ${st.vram_free_mb} MB，监听 PID ${listeningPids().join(',') || '?'}）`
    : '⭕ 没在跑（⚠️ 但这不等于显存已释放，建议再跑一次 nvidia-smi 确认）');
  const p = readPid();
  if (p) console.log('   记录的 PID: ' + p + (st.up ? '' : '（已失效）'));
  process.exit(0);
}

if (cmd === 'start') {
  if (st.up) { console.log(`✅ 已在运行（显存空闲 ${st.vram_free_mb} MB）—— 不重复启动`); process.exit(0); }
  if (!existsSync(PY)) { console.error('✖ 找不到 ' + PY); process.exit(1); }
  console.log('启动 ComfyUI（python_embeded 直启，不开窗口）…');
  const child = spawn(PY, ARGS, { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  writeFileSync(PIDFILE, String(child.pid), 'utf8');
  console.log('   PID ' + child.pid + ' 已记录');
  for (let i = 0; i < 60; i++) {
    await new Promise((s) => setTimeout(s, 2500));
    const p = await probe();
    if (p.up) { console.log(`✅ 就绪（约 ${(i * 2.5 + 2.5).toFixed(0)} 秒），显存空闲 ${p.vram_free_mb} MB`); process.exit(0); }
  }
  console.error('✖ 150 秒内未就绪');
  process.exit(1);
}

if (cmd === 'stop') {
  let n = 0;
  const pid = readPid();
  if (pid) {
    try { execSync(`${PS} "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`); n++; console.log('已停记录 PID ' + pid); } catch {}
    try { unlinkSync(PIDFILE); } catch {}
  }
  for (const p of listeningPids()) {
    try { execSync(`${PS} "Stop-Process -Id ${p} -Force -ErrorAction SilentlyContinue"`); n++; console.log('已停监听 PID ' + p); } catch {}
  }
  // 兜底：路径在 ComfyUI 下的 python 进程（防僵死残留占着显存）
  try {
    execSync(`${PS} "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*ComfyUI*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`);
  } catch {}
  await new Promise((s) => setTimeout(s, 5000));
  const p2 = await probe();
  console.log(p2.up ? `⚠️ 仍在响应（停了 ${n} 个）` : `✅ 已关闭（停了 ${n} 个进程，无窗口残留）`);
  process.exit(0);
}

console.error('用法：node comfyui-ctl.mjs status|start|stop [--root <目录>] [--url <地址>]');
process.exit(1);
