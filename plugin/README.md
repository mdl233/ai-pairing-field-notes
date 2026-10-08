# @mdl233/pairing-notes —— 让 AI 会查《结对实战笔记》

一个 **DSH 插件**。装上之后，AI 多了一个工具 `search_pairing_notes`：

> 你在 DSH 里问「cmd 里中文乱码怎么办」「AI 老跑偏」「下载的大文件打不开」，
> AI 会**先去这套笔记里检索**，带着「篇号 + 标题 + 摘要 + 出处」回答你。

笔记内容 = 本仓库的 [`docs/`](../docs)：**93 条 Windows 中文环境避坑 · 零基础入门 · 协作纪律 · 界面与美术 · 国内资源获取 · 把工作留下来的做法**。

---

## 一、给用户：一句话装好

**把下面这句发给你的 AI（agent）就行** —— 不用自己懂命令行：

```
帮我装这个 DSH 插件：https://github.com/mdl233/ai-pairing-field-notes 的 plugin/ 目录。
按它 README 里的「给 AI 的安装步骤」做，装完告诉我需要我做什么（重启那步我自己来）。
```

> ⚠️ **重启 DSH 这一步只能你自己做**（AI 不该、也不能替你重启宿主）—— 装完 AI 会提醒你。

---

## 二、给 AI 的安装步骤

目标 profile 目录：`~/.dsh/profiles/<name>/`（桌面端通常是 `desktop`；用 `dsh.profile` 字段或问用户确认）。

1. **拷包**：把本目录（`plugin/`）整个复制到
   `<profile>/node_modules/@mdl233/pairing-notes/`（保持目录结构：`lib/`、`cordis.patch.yml`、`package.json`）。
2. **加依赖**：在 `<profile>/package.json` 的 `dependencies` 里加
   `"@mdl233/pairing-notes": "file:./node_modules/@mdl233/pairing-notes"`（或按该 profile 既有插件的写法对齐）。
3. **挂进名册**：在 `<profile>/package.json` 的 `dsh.profile.bundles`（数组）里加上 `"@mdl233/pairing-notes"`。
   —— 这一步等价于本包 `cordis.patch.yml` 里那条 `insert`；两种方式取其一，**别重复**。
4. **请用户重启 DSH**（AI **不得**自行重启宿主）。
5. **重启后验证**：让用户问一句「用 `search_pairing_notes` 查一下 cmd 中文乱码」，
   能看到返回「`01` A2 `.cmd` 编码：GBK + chcp 936」之类的条目，就算装好了。

> 也有一键脚本：`node install.mjs`（默认自动找 desktop profile；`--dry-run` 只看不改）。
> **它不会重启宿主** —— 那一步永远留给人。

---

## 三、它怎么工作（想改的话看这里）

```
plugin/
├─ package.json        ← 声明自己是 DSH 插件（dsh.bundle.patch → cordis.patch.yml）
├─ cordis.patch.yml    ← 就一条 insert：把本插件挂进名册
├─ install.mjs         ← 一键安装（可选）
├─ build-index.mjs     ← 从 ../docs 生成检索索引（改完笔记要重跑）
├─ test-rank.mjs       ← 用真实问题测检索质量（不需要宿主，直接 node 跑）
└─ lib/
    ├─ index.mjs       ← 工具定义（defineTool → search_pairing_notes）
    ├─ rank.mjs        ← 排序纯函数（标题权重 > 正文；短语命中加成）
    ├─ synonyms.mjs    ← ★ 同义词/意图映射（"跑偏"→ 委托/判据/返工）
    └─ index-data.json ← 生成的索引（295 条：89 速查 ＋ 206 章节/小节）
```

**为什么要有 `synonyms.mjs`**：检索失败的头号原因是「**用户的词 ≠ 文档的词**」——
用户说「AI 老**跑偏**」，可 `03` 篇里根本没这两个字（它写的是"委托 / 判据 / 返工"）⇒ 纯字面永远搜不到。
这张表补的就是这一跳。

**检索质量**：`node test-rank.mjs` 用 **14 个真实问题**测，判据是「期望篇号出现在前 5 条里」⇒ 当前 **14/14**。

---

## 四、已知限制（如实）

| 限制 | 说明 |
|---|---|
| 索引是**生成物** | 改了 `docs/` 之后要重跑 `node build-index.mjs`，否则插件用的是旧索引 |
| 只索引**标题 + 小节摘要**（各 500 字） | 不是全文；极细的内容可能漏，但 AI 可以再顺着 `docs/xx.md` 去读原文 |
| 中文检索是**字面匹配 + 同义词** | 没有向量检索；同义词表覆盖不到的说法仍可能搜不到 —— 欢迎提 issue 补词 |
| 需要宿主支持 `@deepseek-ai/dsh-tools` 的 `defineTool` | 版本线见 `peerDependencies` |

---

## 五、许可

**MIT**（脚本部分）· 笔记正文 **CC BY 4.0**。
