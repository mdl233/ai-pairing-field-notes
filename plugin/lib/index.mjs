/**
 * @mdl233/pairing-notes —— 把《AI 结对实战笔记》六篇做成一个 DSH 工具
 *
 * 用户问「cmd 里中文乱码怎么办」「报编码错但文件明明是好的」「AI 老跑偏」这类问题时，
 * 模型调本工具检索笔记，拿到「篇号 + 标题 + 摘要 + 出处」，再据此回答。
 *
 * 索引数据由 ../build-index.mjs 从 docs/ 生成（lib/index-data.json），
 * 排序逻辑在 lib/rank.mjs（纯函数，可单独测：node test-rank.mjs）。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { rank } from './rank.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(HERE, 'index-data.json');
const inject = ['tools'];

let cache = null;
async function loadData() {
  if (cache === null) cache = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  return cache;
}

function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'search_pairing_notes',
    description:
      '检索《AI 结对实战笔记》（六篇开源文档：93 条 Windows 中文环境避坑、零基础入门、跟 AI 协作的纪律、' +
      'AI 做界面与美术、国内网络搞资源、把工作留下来的做法）。' +
      '当用户遇到报错或怪现象、问"这是怎么回事 / 怎么办"、或提到编码 / 路径 / 批量脚本 / AI 跑偏 / 出图 / 下载 / 文档管理时用它；' +
      '返回命中的条目（篇号 + 标题 + 摘要 + 出处），据此回答并给出来源链接。',
    parameters: {
      query: { type: 'string', required: true, description: '用户的问题或关键词，例："cmd 中文乱码"、"报编码错但文件是好的"' },
      limit: { type: 'integer', required: false, description: '返回几条，默认 8，最多 12' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
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
      render: (_args, value) => {
        const lines = value.hits.map((h, i) =>
          `${i + 1}. 【${h.no} ${h.book}】${h.title}\n   ↳ ${h.where}    （docs/${h.file}）`);
        return [{
          type: 'text',
          text: `在《结对实战笔记》里命中 ${value.total} 条（显示前 ${value.hits.length} 条）：\n\n${lines.join('\n\n')}\n\n` +
                `原文：https://github.com/mdl233/ai-pairing-field-notes/blob/main/docs/`,
        }];
      },
    },
    async execute(args) {
      const data = await loadData();
      const limit = Number(args.limit) || 5;
      const hits = rank(data.items, args.query, limit).map((it) => ({
        no: it.no, book: it.book, kind: it.kind, title: it.title, where: it.where, file: it.file,
      }));
      return { query: String(args.query), total: hits.length, hits };
    },
    presentCall: (args) => ({ card: 'generic', title: '检索结对笔记', kind: 'read', rawInput: args }),
  }));
}

export { apply, inject };
