# pairing-notes —— 把结对笔记变成任何 AI 都能用的能力

检索手册，加上工作流搭建。不绑定模型，不绑定 harness。

内容由本仓库的 [docs](../docs) 生成：101 条坑、21 节入门、协作纪律、界面与美术、资源获取、把工作留下。

## 三种用法

| 你的环境 | 怎么用 | 需要装什么 |
|---|---|---|
| 任何 agent、任何平台 | `node core/cli.mjs search "cmd 中文乱码"` | 只要有 node |
| 支持 MCP 的客户端 | 配 `adapters/mcp/`（stdio server） | 见该目录 README |
| DSH（DeepSeek Harness） | 装 `lib/` 这个插件 | 见下文安装步骤 |

核心永远是 `core/`，上面三种只是接入方式，换平台不用改核心。

## 通用入口

```bash
node core/cli.mjs search "cmd 中文乱码"        # 检索，默认 8 条
node core/cli.mjs search "AI 老跑偏" --json    # 机读输出
node core/cli.mjs workflows                    # 列出工作流
node core/cli.mjs workflow 发布                 # 取一个工作流的步骤
node core/cli.mjs index                        # 索引概况
```

退出码：0 正常，1 无命中，2 用法错误。

给 agent 的一句话：

> 需要查「Windows 中文环境的坑」或「该按什么流程做」时，跑 `node <此目录>/core/cli.mjs search "<问题>"`。

## 内置的 7 个工作流

不是知识点，是能照着走的步骤，每步带判据、出处和翻车案例。

| 工作流 | 什么时候用 |
|---|---|
| 跟 AI 开一个新任务 | 要把事交给 AI，尤其"顺手改一下"这类模糊要求 |
| 接手陌生项目、隔天回来 | 忘了干到哪、刚接手一个项目 |
| 发布、交付前检查 | 发帖、开源、交付，含"换维度再扫一遍" |
| 评审改到停不下来 | 进入评审、返工、再评审的循环 |
| 让 AI 做界面、出图 | UI、网页、立绘、素材 |
| 下载搞不定的资源 | 401、403、超时、要登录，含"搞不定就交给人" |
| 维护一个文档库 | 出现"同一件事两处说法不一样" |

## DSH 插件

给用户的一句话：

```
帮我装这个 DSH 插件：https://github.com/mdl233/ai-pairing-field-notes 的 plugin/ 目录。
按它 README 里的「给 AI 的安装步骤」做，装完告诉我需要我做什么（重启那步我自己来）。
```

给 AI 的安装步骤（目标 profile：`~/.dsh/profiles/<name>/`，桌面端通常是 `desktop`）：

1. 拷包：把 `plugin/` 整个复制到 `<profile>/node_modules/@mdl233/pairing-notes/`。
2. 加依赖：`<profile>/package.json` 的 `dependencies` 里加 `"@mdl233/pairing-notes": "file:<绝对路径>"`，写法对齐该 profile 里已有的本地插件。
3. 挂名册：同文件的 `dsh.profile.bundles` 数组里加 `"@mdl233/pairing-notes"`。
4. 请用户重启 DSH（AI 不得自行重启宿主）。
5. 验证：问一句「用 `search_pairing_notes` 查一下 cmd 中文乱码」。

也可以一键：`node install.mjs`（默认自动找 desktop；`--dry-run` 只看不改；不重启宿主）。

装好后 DSH 里多两个工具：`search_pairing_notes`（检索）与 `pairing_workflow`（取工作流）。

## 目录结构

```
plugin/
├─ core/                 通用核心，零依赖零平台
│   ├─ search.mjs          检索：2-gram 加同义词加分层权重
│   ├─ synonyms.mjs        40 条同义词与意图映射（"跑偏"映射到委托、判据、返工）
│   ├─ workflows.mjs       7 个工作流
│   ├─ cli.mjs             通用入口，任何 agent 都能 shell 调
│   └─ index-data.json     索引（由 build-index.mjs 生成，312 条）
├─ lib/                  DSH 适配，薄封装，注册两个工具
├─ adapters/mcp/         MCP 适配（可选）
├─ build-index.mjs       从 ../docs 生成索引
├─ test-rank.mjs         14 个真实问题的检索回归（不需宿主）
├─ install.mjs           一键装，不重启宿主
├─ package.json / cordis.patch.yml
└─ README.md
```

## 设计与实测

为什么要有 `synonyms.mjs`：检索失败的头号原因是用户的词不等于文档的词。用户说「AI 老跑偏」，而 03 篇里没有这两个字（写的是委托、判据、返工），纯字面永远搜不到，调权重也没用。

三轮迭代：

| 版本 | 判据 | 结果 | 改了什么 |
|---|---|---|---|
| v1 | 第 1 条必须完美 | 5/12 | 索引只收章级，03 到 06 的内容全在小节里，没进索引 |
| v2 | 同上 | 4/12 | 收小节，但摘要只取首段 120 字 |
| v3 | 前 5 条含期望 | 14/14 | 过滤表头、摘要 500 字、同义词映射、正文权重 0.5 到 1.5、停用词与阈值 |

已知限制：

| 限制 | 说明 |
|---|---|
| 索引是生成物 | 改了 `../docs/` 之后要重跑 `node build-index.mjs` |
| 只索引标题和小节摘要（各 500 字） | 不是全文，极细内容可能漏，AI 可再读原文 |
| 中文检索是字面加同义词 | 没有向量检索，覆盖不到的说法可以提 issue 补词 |
| DSH 适配需要 `@deepseek-ai/dsh-tools` | 版本线见 `peerDependencies`，核心层没有这个依赖 |

## 许可

代码 MIT，笔记正文 CC BY 4.0。
