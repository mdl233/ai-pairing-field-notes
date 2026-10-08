#!/usr/bin/env node
/**
 * adapters/mcp/server.mjs —— MCP 适配（stdio，**零依赖**，手写 JSON-RPC 2.0）
 *
 * 为什么要有它：core 的能力不绑定 harness，但不同客户端**接入方式不同** ——
 *   支持 MCP 的（Claude Desktop / Cursor / Cline / Continue / 各类 agent 框架…）
 *   只要配一行命令就能用上同一套笔记检索与工作流。
 *
 * 暴露两个 tool：
 *   · search_pairing_notes  —— 检索手册
 *   · pairing_workflow      —— 取工作流（不传 name 则列出全部）
 *
 * 协议要点（MCP 2024-11-05）：
 *   initialize → tools/list → tools/call；notifications/* 不需要响应。
 *   出错时按 JSON-RPC 规范回 error 对象，**不要把异常抛到 stdout**（那会污染协议流）。
 */
import { createInterface } from 'node:readline';
import { search } from '../../core/search.mjs';
import { listWorkflows, getWorkflow } from '../../core/workflows.mjs';

const PROTOCOL = '2024-11-05';
const SERVER = { name: 'pairing-notes', version: '0.2.0' };

const TOOLS = [
  {
    name: 'search_pairing_notes',
    description:
      '检索《AI 结对实战笔记》（93 条 Windows 中文环境避坑 / 零基础入门 / 跟 AI 协作的纪律 / 界面与美术 / 国内网络搞资源 / 把工作留下来的做法）。' +
      '遇到报错、怪现象、"怎么办"，或涉及编码、路径、批量脚本、AI 跑偏、出图、下载、文档管理时用它。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '问题或关键词，例："cmd 中文乱码"、"AI 老跑偏"' },
        limit: { type: 'number', description: '返回几条，默认 8，最多 12' },
      },
      required: ['query'],
    },
  },
  {
    name: 'pairing_workflow',
    description:
      '取《结对实战笔记》里的可执行工作流（步骤 + 判据 + 出处 + 常见翻车案例）。不传 name 则列出全部。' +
      '适用于："我要发布/交付了"、"接手了个陌生项目"、"评审改不完了"、"要让 AI 做界面/出图"、"资源下不动"、"文档库乱了"。',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: '工作流名（支持模糊，如"发布"）；不传则列出全部' } },
    },
  },
];

function callTool(name, args = {}) {
  if (name === 'search_pairing_notes') {
    const r = search(args.query, { limit: Number(args.limit) || 8 });
    if (!r.hits.length) return `没有命中：${args.query}`;
    return `命中 ${r.total} 条（查询：${args.query}）：\n\n` +
      r.hits.map((h, i) => `${i + 1}. 【${h.no} ${h.book}】${h.title}\n   ↳ ${h.where}\n   ↳ docs/${h.file}`).join('\n\n') +
      `\n\n原文：https://github.com/mdl233/ai-pairing-field-notes/tree/main/docs`;
  }
  if (name === 'pairing_workflow') {
    const nm = String(args.name || '').trim();
    if (!nm) return `可用工作流：\n\n${listWorkflows().map((w) => `· **${w.name}** —— ${w.when}（${w.steps} 步）`).join('\n')}`;
    const w = getWorkflow(nm);
    if (!w) return `没有这个工作流：${nm}`;
    return `# ${w.name}\n\n**什么时候用**：${w.when}\n\n**步骤**：\n` +
      w.steps.map((s, i) => `${i + 1}. ${s.do}${s.check ? `\n   · 判据：${s.check}` : ''}${s.from ? `\n   · 出处：${s.from}` : ''}`).join('\n') +
      (w.pitfalls?.length ? `\n\n**常见翻车**：\n${w.pitfalls.map((p) => `· ${p}`).join('\n')}` : '');
  }
  throw new Error(`未知工具：${name}`);
}

/** 处理一条消息；返回 response 对象，或 null（通知/无需响应） */
function handle(msg) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  try {
    switch (method) {
      case 'initialize':
        return ok({
          protocolVersion: PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: SERVER,
          instructions:
            '这是《AI 结对实战笔记》的检索与工作流服务。遇到 Windows/中文环境的报错或怪现象时先检索；' +
            '用户提到发布、接手项目、评审、出图、下载、文档维护时，先取对应工作流。',
        });
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return null;
      case 'ping':
        return ok({});
      case 'tools/list':
        return ok({ tools: TOOLS });
      case 'tools/call': {
        const name = params?.name;
        const args = params?.arguments || {};
        const text = callTool(name, args);
        return ok({ content: [{ type: 'text', text }], isError: false });
      }
      case 'resources/list':
        return ok({ resources: [] });
      default:
        return id === undefined ? null : err(-32601, `未实现的方法：${method}`);
    }
  } catch (e) {
    return err(-32603, `工具执行失败：${e?.message ?? e}`);
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try { msg = JSON.parse(t); } catch { return; }   // 非法行直接忽略，别污染协议流
  const res = handle(msg);
  if (res) process.stdout.write(JSON.stringify(res) + '\n');
});
