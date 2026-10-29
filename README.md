# ai-pairing-field-notes

> 跟 AI 结对干活的实战笔记：101 条坑、21 节入门、协作纪律、界面与美术、资源获取、把工作留下。

![跟 AI 结对干活 · 真踩过的坑](assets/cover.png)

单人加 AI 协作做个人项目，踩过之后写下来。不是整理网上资料的产物。

## 环境

这些结论只对下面这台机器负责。

| 项 | 值 |
|---|---|
| 系统 | Windows 11 家庭中文版 25H2（build 26200） |
| CPU | AMD Ryzen 7 7840HS（8 核 16 线程） |
| 内存 | 32 GB |
| 显卡 | NVIDIA RTX 4050 Laptop 6 GB |

## 六篇

| 篇 | 是什么 | 适合谁 |
|---|---|---|
| [01 避坑](docs/01-windows-chinese-dev-pitfalls.md) | 101 条，附 97 行速查表。每条给症状、根因、正解、判别方法 | 在用命令行、脚本与 AI 工具链的人 |
| [02 从零开始](docs/02-getting-started-with-ai-pairing.md) | 21 节。文件与路径、进程与端口、编码、命令行、怎么跟 AI 协作 | 编程零基础 |
| [03 协作纪律](docs/03-discipline-of-pairing-with-ai.md) | 委托三件套、证据四形态、假成功与假失败、反馈三条、止损线 | 已经把 AI 当协作者的人 |
| [04 界面与美术](docs/04-ai-ui-and-art-pipeline.md) | 界面用代码做别手绘、提示词要写设计风格、本地出图、出图后自查 | 用 AI 做 UI、网页、立绘的人 |
| [05 资源获取](docs/05-getting-resources-in-china.md) | 下载三档、通道实测、大文件截断、下不动交给人、插件安装 | 被下载问题卡住过的人 |
| [06 把工作留下](docs/06-keeping-the-work.md) | 记录与接力、真相源、可逆性、验证、成本 | 想把长期项目留住的人 |

![六篇总览](assets/card-overview.png)

参考： [索引](docs/00-INDEX.md) · [术语表](docs/00-GLOSSARY.md) · [同步对照](docs/SYNC.md) · [工具脚本](tools/)

## 工具

7 个零依赖脚本，配好 Node.js 或 Python 直接跑。

| 脚本 | 干什么 |
|---|---|
| [verify-utf8.mjs](tools/verify-utf8.mjs) | 全文 UTF-8 校验 |
| [verify-refs.mjs](tools/verify-refs.mjs) | 文档内引用的可解析性检查 |
| [sanitize-check.mjs](tools/sanitize-check.mjs) | 发布前脱敏扫描 |
| [doc-index-check.mjs](tools/doc-index-check.mjs) | 文档库体检：未登记、悬空、互指、污染 |
| [local-generate.py](tools/local-generate.py) | 本地 ComfyUI 出图 |
| [cloud-generate.py](tools/cloud-generate.py) | 云端 API 出图 |
| [comfyui-ctl.mjs](tools/comfyui-ctl.mjs) | ComfyUI 的启动、停止、查状态 |

## 怎么用

- 遇到怪现象：翻 `docs/01` 的速查表。
- 刚接触命令行：从头读 `docs/02`。
- 想把 AI 用稳：读 `docs/03`。
- 做界面或出图：读 `docs/04`。
- 卡在下载与安装：读 `docs/05`。
- 照做后对不上：开 [Issue](https://github.com/mdl233/ai-pairing-field-notes/issues/new/choose)。

文中路径写作占位符（`<工作区>`、`%USERPROFILE%`、`<主机名>`），换成你自己的即可。出处里的 `NN 号 §x.y` 是作者本机的笔记编号，按内容理解。

## 版本

| 版本 | 时间 | 一句话 |
|---|---|---|
| v1.0 | 2026-09-22 | 三篇起步 |
| v2.0 | 2026-10-06 | 六篇加工具；避坑 93 条，新增 UI 一章 |
| v2.1 | 2026-10-06 | 加配图 |
| v2.2 | 2026-10-08 | 加索引、术语表、同步表、站点，插件三接入；避坑 99 条 |
| v2.3 | 2026-10-27 | 避坑 102 条（矢量化门槛、Godot 贴图、预览与实机） |
| v2.4 | 2026-10-27 | 更正一处编造：删掉无出处的版本号 |
| v2.5 | 2026-10-27 | 删反例警告；加下载三档 |
| v2.6 | 2026-10-27 | 本地小模型改成"我没在用，不推荐" |
| v2.7 | 2026-10-28 | 全篇按作者风格重排；01 重导；配图重做 |

## 许可

文档 CC BY 4.0，脚本 MIT。详见 [LICENSE](LICENSE) 与 [LICENSE-docs](LICENSE-docs)。

## 作者

[MDL233](https://github.com/MDL233)，单人加 AI 协作做个人项目。
