/**
 * DSH 适配层 —— 只是 `../core/` 的**薄封装**
 *
 * ★ 真正的逻辑全在 `core/`（检索 + 工作流），**不绑定模型、不绑定 harness**：
 *   任何 agent 都能 `node core/cli.mjs search "..."` 用它，不必装插件。
 *   本文件只负责把 core 的能力**注册成 DSH 的两个工具**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { search } from '../core/search.mjs';
import { listWorkflows, getWorkflow } from '../core/workflows.mjs';

const inject = ['tools'];
const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * 原文在哪 —— ★ 优先**本地 docs 副本**（`install.mjs` 会把仓库的 docs/ 一起拷进包）。
 * 为什么：国内网络点不开 GitHub；而本地路径**模型能直接去读**，人也能直接打开。
 * 没有本地副本时才回落 GitHub 链接；也可用环境变量 PAIRING_NOTES_DOCS 指定别处（多份笔记 / 自定义部署）。
 */
function docsBase() {
  const custom = process.env.PAIRING_NOTES_DOCS;
  if (custom && fs.existsSync(custom)) return path.resolve(custom).replace(/\\/g, '/');
  const local = path.join(HERE, '..', 'docs');
  if (fs.existsSync(local)) return path.resolve(local).replace(/\\/g, '/');
  return 'https://github.com/mdl233/ai-pairing-field-notes/blob/main/docs';
}

function apply(ctx) {
  // ① 检索手册
  ctx.tools.register(defineTool({
    name: 'search_pairing_notes',
    description:
      '检索《AI 结对实战笔记》（六篇开源文档：93 条 Windows 中文环境避坑、零基础入门、跟 AI 协作的纪律、' +
      'AI 做界面与美术、国内网络搞资源、把工作留下来的做法）。' +
      '当用户遇到报错或怪现象、问"这是怎么回事 / 怎么办"、或提到编码 / 路径 / 批量脚本 / AI 跑偏 / 出图 / 下载 / 文档管理时用它；' +
      '返回命中的条目（篇号 + 标题 + 摘要 + 出处），据此回答并给出来源链接。',
    parameters: {
      query: { type: 'string', required: true, description: '用户的问题或关键词，例："cmd 中文乱码"、"AI 老跑偏"' },
      limit: { type: 'integer', required: false, description: '返回几条，默认 8，最多 12' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          query: { type: 'string', required: true },
          total: { type: 'integer', required: true },
          hits: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                no: { type: 'string', required: true },
                book: { type: 'string', required: true },
                kind: { type: 'string', required: true },
                title: { type: 'string', required: true },
                where: { type: 'string', required: true },
                file: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_a, v) => [{
        type: 'text',
        text: `在《结对实战笔记》里命中 ${v.total} 条（查询：${v.query}）：\n\n` +
          v.hits.map((h, i) => `${i + 1}. 【${h.no} ${h.book}】${h.title}\n   ↳ ${h.where}\n   ↳ docs/${h.file}`).join('\n\n') +
          `\n\n原文：${docsBase()}/`,
      }],
    },
    async execute(args) {
      const r = search(args.query, { limit: Number(args.limit) || 8 });
      return {
        query: r.query,
        total: r.total,
        hits: r.hits.map((h) => ({ no: h.no, book: h.book, kind: h.kind, title: h.title, where: h.where, file: h.file })),
      };
    },
    presentCall: (args) => ({ card: 'generic', title: '检索结对笔记', kind: 'read', rawInput: args }),
  }));

  // ② 工作流（不填 name ⇒ 列出全部）
  ctx.tools.register(defineTool({
    name: 'pairing_workflow',
    description:
      '取《结对实战笔记》里的**可执行工作流**（步骤 + 判据 + 出处 + 常见翻车案例）。' +
      '不传 name 则列出全部。适用场景：用户说"我要发布/交付了""接手了个陌生项目""评审改不完了"' +
      '"要让 AI 做界面/出图""资源下不动""文档库乱了" —— 这些都有现成的工作流可照走。',
    parameters: {
      name: { type: 'string', required: false, description: '工作流名（支持模糊，如"发布"）；不传则列出全部' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          listed: { type: 'array', required: true, items: { type: 'object', additionalProperties: true } },
          workflow: { type: 'object', additionalProperties: true },
        },
      },
      render: (_a, v) => {
        if (v.workflow) {
          const w = v.workflow;
          return [{
            type: 'text',
            text: `# ${w.name}\n\n**什么时候用**：${w.when}\n\n**步骤**：\n` +
              w.steps.map((s, i) => `${i + 1}. ${s.do}${s.check ? `\n   · 判据：${s.check}` : ''}${s.from ? `\n   · 出处：${s.from}` : ''}`).join('\n') +
              (w.pitfalls?.length ? `\n\n**常见翻车**：\n${w.pitfalls.map((p) => `· ${p}`).join('\n')}` : ''),
          }];
        }
        return [{
          type: 'text',
          text: `可用工作流：\n\n${v.listed.map((w) => `· **${w.name}** —— ${w.when}（${w.steps} 步）`).join('\n')}`,
        }];
      },
    },
    async execute(args) {
      const name = String(args.name || '').trim();
      if (!name) return { listed: listWorkflows(), workflow: null };
      const w = getWorkflow(name);
      return { listed: [], workflow: w || null };
    },
    presentCall: (args) => ({ card: 'generic', title: '取工作流', kind: 'read', rawInput: args }),
  }));
}

export { apply, inject };
