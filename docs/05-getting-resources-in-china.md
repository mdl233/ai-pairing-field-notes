# 在国内网络里搞到模型、插件与工具

> 这不是翻墙教程，是一份通道与校验的实测记录。
> 模型权重、插件包、命令行工具大多托管在境外，"拿得到"本身就是一道关（§1 是实测通道，§1.5 是三档策略）。
> 本篇只讲怎么拿、怎么验、拿不动怎么办；这些工具怎么用见 `04` 与本仓其它篇。
> 所有"可用性"结论只代表我这台机器、这个网络、这一天（2026-10）。网络策略会变，请以自己的实测为准。
> 时效：复核 2026-10-27。带日期的条目会随环境变化，用前按文中命令复核一次。
> 本篇时效敏感区：§1 的通道实测表、§1.5 的三档策略。镜像与节点都会变，只代表作者那台机器、那一天。

---

## 1 通道实测表（先看这张，能省你半小时）

| 通道 | 我这台机器 | 怎么用 |
|---|---|---|
| `registry.npmjs.org`（npm 官方） | 被墙（`fetch failed`） | 换镜像，见下行 |
| `registry.npmmirror.com` | node 可直连 | 元数据 `…/<包名>`；包体 `…/<包名>/-/<包名>-<版本>.tgz` |
| GitHub 直连（`git clone` / Release） | 连接被重置 | 走代理镜像，见 §2 |
| `gh-proxy.com` / `ghproxy.net` | 可用 | `git clone` / Release `.tgz` / 单个原始文件 |
| `raw.githubusercontent.com` | 可用（配镜像） | 取仓库里的单个文本文件 |
| `cdn.jsdelivr.net` + `data.jsdelivr.com` | 浏览器可访问 | 列包内文件：`data.jsdelivr.com/v1/package/{gh,npm}/<包>[@版本]/flat`；取源码：`cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<路径>` |
| `huggingface.co`（模型） | 慢、易断 | 换 `hf-mirror` |
| `hf-mirror` 大文件 | 超过 1 GB 会截断 | 分段下载，见 §3 |
| `pypi.org` | 慢 | 清华镜像 `pypi.tuna.tsinghua.edu.cn/simple` |
| `civitai.com` / `itch.io` | 需登录或需代理 | 交给人，见 §4 |

纪律：先试直连，失败换正规镜像，镜像也不行就交给人。不要反复重试同一个不通的地址，也不要退而去找可疑的第三方镜像站。

---

## 1.5 三种常规下载途径

1. 直连。用于国内源、内网、本机服务。

2. 国内镜像站点：
   - pypi 清华源：装 Python 包。`pip install --index-url https://pypi.tuna.tsinghua.edu.cn/simple <包>`。torch、numpy 这类大包用它最省事。
   - npm npmmirror：装 Node 包。`npm config set registry https://registry.npmmirror.com`（pnpm 同样认这个配置）。
   - hf-mirror.com：取 HuggingFace 模型权重。设 `HF_ENDPOINT=https://hf-mirror.com` 后按原命令下载；单文件超过 1 GB 会截断，要分段下（见 `L4`）。
   - ghproxy.net：取 GitHub 的单个文件（raw / release）。在原地址前加前缀：`https://ghproxy.net/https://raw.githubusercontent.com/...`。整仓 clone 不适用（clone 见 §2）。

3. 国外节点。前两种都不通时使用（被墙、reset、超时）。可以用 clash。节点按流量计费。

判断方法：先发一次 `Range: 0-0` 探通，根据返回结果选择。

## 2 GitHub：两个开关一条命令

clone 整仓要改两处：

1. 地址前加 gh-proxy.com（镜像）。
2. 加 `-c http.sslBackend=openssl`。Windows 上 git 默认用 schannel，走镜像会报证书链错误，换 openssl 后端即可。

```bash
git -c http.sslBackend=openssl clone https://gh-proxy.com/https://github.com/<owner>/<repo>.git
```

只取 Release 里的单个包：

```bash
https://gh-proxy.com/https://github.com/<owner>/<repo>/releases/download/<tag>/<包名>.tgz
```

只要仓库里几个文件：用 jsdelivr，它能先列文件清单再取。

判据：浏览器能打开不等于命令行能下载。同一个地址要用目标工具试一次。例：`registry.npmjs.org` 浏览器能开，node 报 `fetch failed`。

---

## 3 大文件截断

现象：模型显示"下载完成"，加载报损坏。

原因：镜像对大文件静默截断。不报错、不断开，只是少了字节。

处理：

1. 超过 1 GB 的文件分段（range）下载，逐段追加。
2. 下完立刻校验。
3. 加载报损坏时先核字节数，再怀疑推理框架。

校验（所有下载都适用）：

- 有官方哈希就对 SHA-256。
- 没有哈希就核字节数，与发布页一致。

gated 仓库（401/403）不是网络问题，是要授权。换同内容的非 gated 仓更快。例：`stabilityai/sdxl` 是 gated，`stabilityai/stable-diffusion-xl-base-1.0` 可直接取。

---

## 4 拿不动就交给人

一条通道不可用（要登录、验证码、代理、付费）时，立刻更换策略，向用户报告。

把四样一次给全：资源名、直链、目标目录、体积。

用户下好放到约定目录，AI负责入库、归位、校验。

AI会在不断尝试中浪费很多时间，遇到长时间无进度的情况要优先向用户报告。


---

---

## 5 插件：找 → 装 → 验

### 5.1 找

社区有插件目录站（中文界面）。每张卡片标：包名、CI 实测结果、安装命令、活跃度。

它的价值不只是省搜索：站内文档教当前版本的装配语法，是权威参考。有的站还提供目录插件，装上后对 agent 说"给我装个记忆插件"，由 AI 自己去找。

### 5.2 装：四步

| 步骤 | 命令 | 作用 |
|---|---|---|
| ① | `dsh plugin --profile <档案> add <包名>[@版本]` | 装，写档案的 `package.json` |
| ② | `dsh plugin --profile <档案> version-exemptions` | 看 peer 告警与现有豁免 |
| ③ | 重启 DSH（桌面端退出后重开） | 重建插件注册表 |
| ④ | `node <工作区>/50-tools/dsh-plugin-doctor.mjs` | 体检：零 pending、零 skipping 才算成 |

### 5.3 三道坎

1. peer 兼容门。插件依赖范围与宿主不符时静默跳过：站点起得来，功能整块没有。逃生阀是精确版本豁免（`allow-version … --accept-risk`）。官方原话是可能导致崩溃或数据损坏，只在隔离环境或确有必要时用。
2. 名字解析。手工装时，插件自带配置里写的是不带前缀的短名，会 `failed to import`。建一个同名别名目录即可。
3. 必须重启。不重启，新插件没进注册表，删掉的插件还在内存里引用着，GUI 白屏。

副作用：跑任何 `plugin` 子命令后，diff 一遍档案里的依赖与挂载清单。有一次我只跑了查看豁免的命令，事后发现一个早已摘掉的插件被塞回去了。

### 5.4 兜底：手工装三步

官方安装会触发整树重建（宿主运行时不要做）时，走手工：

1. 从 npmmirror 取 `.tgz`。解包时 Windows 盘符（`F:`）会被当成远程主机名，先切到目标目录，用相对文件名。
2. 解包到稳定位置（别放会被清理的临时目录），再复制进档案的 `node_modules`。
3. 在档案 `package.json` 里加 `dependencies`（指向稳定位置）和挂载清单一条，然后校验 JSON 无 BOM。

---

## 6 本地小模型：我没在用，不推荐

我装过 `ollama`，但几个 4B / 7B 小模型实际没在用。日常问答、抽取、翻译走 API，本地只跑生图（见 `04`）。所以这节不给模型推荐，也不贴速度数字。

### 6.1 要自己跑，只看三条判据

1. 先量显存再选参数量。4B 级在 6 GB 卡上能整块放进 GPU；7–8B 级要 offload。更大的我没试过，不下结论。
2. 判据命令 `ollama ps`，看 `PROCESSOR` 列。`100% GPU` 才是真快；出现 `CPU` 就是在 offload。
3. "某模型在本机不可用"这类结论必须带运行时版本与日期。否则事后无法复现 —— 我踩过：旧结论没记版本，后来连是哪个版本不行都说不清。

为什么不推下去：长会话成本大头是每步重发读过的内容（实测 90%+），理论上本地模型能在源头拦掉，但我的使用里没跑通。

---

## 7 批量找资料：脚本干活，大模型只读摘要

一次性要几十到几百条外部数据时（榜单、评论、同类产品），不要把网页一条条喂给大模型。

```
脚本爬取 → 清洗 → 聚类（本地完成，零 LLM token）
                 ↓
          只把聚类摘要给大模型
```

为什么：几百条原始数据全塞进上下文，贵且乱。聚类后大模型看到几组主题和代表样本，信息密度高。

实测：抓取、清洗、聚类不消耗 token，只花在最后读摘要。

同理适用于本地大文件：先用脚本 / grep / 本地模型定位，只把相关片段交给大模型。

---

## 8 附：三个配套工具（已随本仓发布）

| tools/ 里的文件 | 原名 | 干什么 |
|---|---|---|
| [`local-generate.py`](../tools/local-generate.py) | `gen_sdxl.py` | 本地 ComfyUI 出图（免费、离线） |
| [`cloud-generate.py`](../tools/cloud-generate.py) | `gen_seedream.py` | 云端 API 出图（收费，效果更强） |
| [`comfyui-ctl.mjs`](../tools/comfyui-ctl.mjs) | `comfyui.mjs` | ComfyUI 的 `status / start / stop`（幂等启停） |

命名教训：原名里的 `gen_` 是 generate，后缀是模型名不是功能名。`SDXL` 是本地模型，`seedream` 是云端模型的名字。这种命名对作者方便，对读者不友好，看不出一个走本地一个走云端。发布时改了。

发布前做了两件事：

1. 去掉凭据引用。改成从环境变量读（`cloud-generate.py` 读 `ARK_API_KEY`），脚本里不留 key，也不读私有凭据文件。
2. 路径参数化。环境变量加命令行参数优先（`COMFYUI_ROOT` / `COMFYUI_URL` / `--root` / `--url`），不留本机绝对路径。

顺带修掉一个真问题：原脚本默认后端写成量化版（GGUF），而它自己的注释和手册都说量化版弃用（出图发糊），默认值指向了被否定的路径。发布版改成 fp16。

---

## 9 一页速查

| 你遇到的情况 | 怎么办 |
|---|---|
| npm 装不上 | 换 npmmirror。浏览器能开不等于命令行能通 |
| GitHub clone / 下载失败 | 走 gh-proxy，并加 `-c http.sslBackend=openssl` |
| 只要仓库里几个文件 | 用 jsdelivr，能先列文件清单 |
| 大模型文件加载报损坏 | 先核字节数。超过 1 GB 要分段下载 |
| 仓库 401/403 | 是 gated，换同内容的非 gated 镜像仓 |
| 下完不知道对不对 | SHA-256 / 字节数对拍。下载完成不等于完整 |
| 需要登录 / 需要代理 | 交给人，给全四样：资源名、直链、目标目录、体积 |
| 插件装完没反应 | 看 peer 门是否静默跳过。必须重启，再跑体检 |
| 本地模型好慢 | 先 `ollama ps` 看是否 100% GPU，再考虑升级运行时后重测 |
| 几百条外部资料 | 脚本爬 + 聚类，大模型只读摘要 |

---

*作者：MDL233 ｜ 许可：CC BY 4.0 ｜ 本文所有"可用性/速度"结论均为特定时间、特定机器的实测，请以你自己的环境为准。*
