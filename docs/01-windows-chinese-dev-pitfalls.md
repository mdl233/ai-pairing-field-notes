# Windows + 中文环境 开发避坑手册

> **定位**：**真踩过**的坑 —— 症状、根因、正解、判别方法。**不写没踩过的理论**。
> **用法**：① 遇到怪现象 → 先翻 **§一 速查表**（按"你看到的现象"查）；② 想系统看某类 → 进对应主题；③ 新坑 → 追加到对应主题 + 速查表补一行。
> **读者**：在 **Windows + 中文环境**下用命令行、脚本与 AI 工具链的人。
> **口径**：文中路径统一以占位符表示（`<工作区>` / `%USERPROFILE%` / `<主机名>` / `<VMUSER>` 等），**替换成你自己的即可**；条目末尾"出处"里的 `NN 号 §x.y` 是作者本机的内部笔记编号（文中已统一写作「同仓另篇」），**按内容理解即可，不必去找那些文件**。
> **建立**：2026-09-21 ｜ **最后整理**：2026-09-22

---

## 一、速查表（遇到怪现象先看这里）

| 你看到的现象 | 一句话正解 | 详情 |
|---|---|---|
| `.cmd` 菜单按了没反应 / 报"此时不应有" | 块内 `echo` 的**半角括号**会终止 if 块 ⇒ 改**全角** | A1 |
| 中文 `.cmd` 报 `'??' 不是内部或外部命令` | 用 **GBK + `chcp 936`**；别用 UTF-8 + 65001 | A2 |
| 管道喂 `.cmd` 卡死 / 报 `'S' 不是命令` | 别用 stdin 喂交互式 cmd ⇒ 字节重定向或加 `--smoke` | A3 |
| `cmd //c` 加了 `MSYS_NO_PATHCONV=1` 后行为怪 | **两者不能混用**：有 env 用 `/c`，无 env 用 `//c` | B1 |
| `VBoxManage` 报找不到 `/bin/bash` | 加 `MSYS_NO_PATHCONV=1`（否则被转成 Git 路径） | B1 |
| `rm -rf $VAR/xxx` 差点删到根目录 | 危险路径**写全绝对路径**；删除前先 `echo`/`ls` 预演 | B2 |
| grep / node 统计路径全是 0 | Git Bash 多层反斜杠转义不可靠 ⇒ **写成脚本文件** | B3 |
| 改完 GBK 文件，换行**全变成 LF** | **别用 `iconv \| sed` 管道**（它会吞 `\r`）⇒ 走 pwsh .NET | B4 |
| node 读 GBK 文件乱码 | `new TextDecoder('gbk')`（Node 18+ 内置，无需 iconv） | C1 |
| node 想**写** GBK 文件 | **做不到**（TextEncoder 只出 UTF-8）⇒ 走 pwsh `[IO.File]::WriteAllText` + `Encoding(936)` | C2 |
| 点了按钮，React 毫无反应 | 受控组件**不能用 JS `click()`** ⇒ 用 `pilot_click` | D1 |
| 对话框按钮全变灰、彻底卡死 | **绝不** `removeAttribute('disabled')` ⇒ 只能刷新页面 | D2 |
| 复选框以为勾了、其实没勾 | `snapshot` 的 `on` ≠ `checked` ⇒ 用 `pilot_eval` 复查 | D3 |
| pilot 想点"确认"，结果点了"取消" | 别用 CSS 猜 ⇒ 用 snapshot 给的 **ref** | D4 |
| 脚本崩在半途、数据被改了一半 | 读 JSON 前**先确认字段名**；**先 dry-run 再 apply** | E1 |
| 脚本"没输出"，以为一切正常 | `2>/dev/null` 会吞掉崩溃原因 ⇒ 诊断一律 `2>&1` | E2 |
| 直写 mnemon 库后向量/合并出问题 | 软删语义要成对写；**必须回填 embedding + 同步 staging** | E3 |
| 批量改记忆/文档想"零返工" | 冷备份 → dry-run → apply → **逐项核对** → 同步 staging | E4 |
| 验收记忆上限时读不到字段 | `mnemon_status` **不吐上限** ⇒ 用「注入头分母 + settings + 源码」三件套 | G1 |
| 日志反复刷 `idle review failed` | 插件侧共性、**零副作用** ⇒ 先观察；要治升 0.5.12 | G2 |
| 历史会话搬不到新工作区 | 会话归属由**会话自己的 cwd** 决定 ⇒ 只能在新工作区**新开**会话 | G3 |
| pilot 操作 GUI 步骤多、怕点错 | ① `pilot_eval` 精确设 id 再点 ② 对话框按钮用"祖先链含特征文本"消歧 | G4 |
| 重启后 GUI 全灭、报 `without inject` | 客户端 bundle 必须导出 `inject` + `apply` | H1 |
| 页签出来了、内容区是 slot-error 占位 | createForm 必须含 `subscribe`；渲染路径要真机验 | H2 |
| 改一个下拉，另一个字段冒出非法值 | 渲染循环闭包别用 `var` ⇒ 用 `let` | H3 |
| 插件启用了，客户端却说"命名空间不可用" | api-proxy 硬编码白名单 ⇒ 源码 + `lib/` 两处都加 | H4 |
| 改了插件源码，行为照旧 | 跨盘 `file:` 依赖是真复制；版本号 +1 才重装 | H5 |
| `cordis.patch.yml` 改好又变回去 / 重复 loader id | 别用 `dsh plugin add`；profile patch 只写 disable | H6 |
| 装完插件，所有工具调用报 `reading 'prepare'` | 该插件依赖 `@deepseek-ai/dsh-tools` ⇒ 撤下它 | H7 |
| 预设插件装了，选择器里看不到 | presets 只扫一级目录 + junction 装配 + 装完必重启 | H8 |
| 发消息报 `reading 'filter'/'some'`、GUI 一闪而逝 | 插件版本/peer 与宿主不匹配（皮肤冲突同理） | H9 |
| 启动报 `cannot resolve profile bundle X` / 装了版本没变 | 配置与依赖要成对；版本切换必须完整 `pnpm install` | H10 |
| 升级全家桶后 GUI 全灭、报 `Failed to load plugins` | 新版删了子包而清单还引用它 ⇒ 别乱升，用回滚脚本 | H11 |
| 打开会话报 `lacks an identified message` | 补 `data.id` 后按帧重压；先备份 | I1 |
| 压缩校验全绿，GUI 仍说会话坏 | 压缩完整 ≠ 健康 ⇒ 跑语义校验（seq/turn/id） | I2 |
| GUI 打开 headless 会话报 `torn JSONL record` | headless 写入器系统性损坏 ⇒ 任务后必跑 fix-session | I3 |
| 同一批任务：跑完的能开、在跑的报 `seq gap` | 运行中不点开会话，等修完再验 | I4 |
| 报 `invalid current range` / `no adjacent shadow price` | 是语义不兼容不是损坏 ⇒ 做兼容性修补，勿删事件 | I5 |
| 工具报 `densely contain`，文件其实健康 | 该工具绕过持久化层 ⇒ 换走宿主加载路径的校验器 | I6 |
| 同一会话：旧版本读 FAIL、新版本读 PASS | 写/读会话须 ≥0.1.2 同代；禁止回滚 0.1.1 系 | I7 |
| seq 修好后 GUI 又报 seed 引用错 | 连续化必须同步 `sourceEventSeqs` 映射表 | I8 |
| 两轮修复后只剩"中间态"、退不回原始 | 多轮修复用带序号的独立备份名 | I9 |
| 统计说"某会话 N 处反转"却对不上 | fork 血缘按 header `seedLength` 切；修父会话要扫子代理 | I10 |
| 拿一份扫描输出当"单会话证据" | 扫描证据三原则：file 字段 + 单会话隔离 + 血缘去重 | I11 |
| 长会话打开变慢、动辄几秒几 GB | >30 万 token 或 `summary` ≥2 次就开新会话 | I12 |
| 会话修完立刻又坏 | 活动会话不能在线改 ⇒ 先停服再动文件 | I13 |
| 升级脚本"跳过"没重做 / 账本被清零 | 幂等设计 + 别重跑初始化步；用 `--adopt-new` 补录 | I14 |
| 启动后浏览器 401 unauthorized | 0.1.2+ 有认证 ⇒ 用带 token 的启动 URL 或复用 cookie | I15 |
| 按报错里的会话 id 找不到文件 | 前端会截断 id（少一位）⇒ 列目录确认真实 id | I16 |
| headless 派工报 unknown option / 命令被截断 | 任务文本禁 `-` 开头词；传参一律 base64 | J1 |
| 派了工，前端工作区里看不到会话 | headless 不写注册表 ⇒ `--fix-register` + 先 `cd` | J2 |
| `--patch` 指定了模型，实测还是别的模型 | settings.yaml 压过 patch ⇒ 改 `agent-default-model` | J3 |
| headless 会话不受预设约束 | headless 不挂 agentPreset ⇒ 派工前缀模板注入 | J4 |
| 会话结束后 dev server 被杀 | headless 回收派生进程 ⇒ 长驻服务交 systemd | J5 |
| 页面"没动静"但进程 CPU 一直涨 / 看板全"待处理" | 后台在跑 ≠ 在推进 ⇒ 三查一次做完 | J6 |
| 汇报"已派工"，实际消息还在输入框里 | `innerText` 检查是假验证 ⇒ 用派工成功三标准 | J7 |
| 模型中途卡审批、停住不动 | 开工五必设：访问模式与审批策略是两个独立开关 | J8 |
| VM 报"工具故障"，主机跟着修错方向 | VM 侧诊断只到表象 ⇒ 主机自己进 VM 查根因 | J9 |
| 守卫每次都在拒绝（preflight 恒失败） | 探针匹配到了自己的命令行 ⇒ 关键词走环境变量 | K1 |
| `stop` 说"端口已空闲"，`start` 起了第二个实例 | 探测失败被当成"确认为否" ⇒ `null` 与 `false` 要分开 | K2 |
| 守卫自测全绿，线上仍被绕过 | 守卫要双向断言；"保命组件"必须真跑一次 | K3 |
| 端口明明在听，脚本说没监听 | 判据只认字面量 IP ⇒ 要覆盖 IPv6 / 通配绑定 | K4 |
| `dsh.cmd stop` 后脚本仍报"服务在跑" | 残留 ts-proxy 也监听 `:3080` ⇒ 放宽匹配前先枚举监听者 | K5 |
| 文件工具读 `<工作区>/...` 说文件不存在 | 文件工具传 `<工作区>/...`；`<工作区>` 只在 bash/pwsh 里对 | K6 |
| 中文变 `???` / U+FFFD / 整段字符消失 | 编码用错即永久损毁 ⇒ 按文件类型选编码 + 走 pwsh | K7 |
| `JSON.parse` 莫名失败 / `.ps1` 中文语法错乱 | JSON 禁 BOM（查前 3 字节）；`.ps1` 要 BOM 或走 node | K8 |
| 脚本报"已改完"，实际只改了一半 | 改文件按行号，不靠模式匹配；改完跑真测试 | K9 |
| 扫描报"无异常 ✓"，其实一个文件都没扫到 | `-Include` 必须配 `-Recurse`，否则静默返回空 | K10 |
| `set /p` 读到的值是文件名 / `timeout /t` 报参数错 | cmd 参数类坑 ⇒ 换 pwsh `Get-Content -Raw` / 绝对路径 | K11 |
| `dsh.cmd stop` 之后辅助件又起来了 | `--ensure` 在命令分派前执行 ⇒ 先 stop 再停辅助件 | K12 |
| 脚本打 usage，调用方却报"成功" | spawn 里只把第一个 token 拼路径；`ok:true` ≠ 执行了 | K13 |
| 双击启动器报 `'uncher' 不是内部或外部命令` | 批处理被 LF 化了 ⇒ 必须 CRLF，写完校验换行符 | K14 |
| `schtasks` 报拒绝访问 | 沙箱下 Task Scheduler 不可用 ⇒ 换常驻定时器 / cron | K15 |
| rsync 报成功，目标文件却没变 | `--update` 保留较新目标 ⇒ 首次先 `touch` 归零 mtime | K16 |
| 本地出图整体糊 | GGUF 量化路径弃用 ⇒ 直接 fp16 safetensors | L1 |
| IPAdapter 找不到模型 / 出图清晰度暴跌 | 文件名要匹配预设正则；权重降到 0.4 + style transfer | L2 |
| 男性角色立绘全变女性 | prompt 必带性别标签（`1boy, adult male, masculine`） | L3 |
| 下载的模型加载报损坏 | hf-mirror 大文件会截断 ⇒ 分段 range；gated 换镜像仓 | L4 |
| 生成的图片链接隔天 404 | url 只活 24 h ⇒ 立刻下载转存或改 `b64_json` | L5 |
| 素材右下角有"AI生成"字样 | `watermark` 默认 `true` ⇒ 显式传 `false` | L6 |
| 长 prompt 出图"缺元素"，每次缺的不一样 | 超长是丢元素 ⇒ 压到 ≤300 汉字 / 600 英文词 | L7 |
| 出图里出现箭头线框 / 参考图上传报错 | 交互编辑标记要自己画 ⇒ 补"移除草图线条"；Base64 名小写 | L8 |
| `digest` 说"无直接证据"，可原文明明有 | 解析降级假失败 ⇒ 看"回答"栏是否写"(解析失败…)" | L9 |
| `digest --api-url` 报 404 / `--help` 没用 | ollama 要加 `/v1` 或用 `--ollama`；`--help` 不存在 | L10 |

| 在 `pwsh` 里写 7 的语法（`&&` / `??`）不生效 | harness 的 `pwsh` **工具**走 5.1（名字骗人）⇒ **想要 7 就在 bash 里调 `pwsh`**（实测 7.6.6 可用） | K17 |
| Python 脚本输出中文乱码 / `uv run` 用的不是系统 Python | Windows 下 stdout 默认 cp936 ⇒ 加 `PYTHONIOENCODING=utf-8`；`uv run` 用 uv 自管解释器 | K18 |
---

## 二、A. Windows 批处理（`.cmd` / `.bat`）

### A1 ⚠️ 块内 `echo` 里的**半角括号**是语法炸弹

- **症状**：菜单脚本的某个分支"解析坏" —— 输入选项走不到正确分支，只能手敲命令；cmd 报 `(ts) 此时不应有`。
- **根因**：`if "%CH%"=="4" ( … echo 原件改名 .bak-pre015-(ts) … )` 里的 `)` 被 cmd 当成**块结束符**，整个 `if` 块解析错乱（`(` 同理）。
- **正解**：块内 `echo` 一律用**全角括号 `（ts）`**，或转义 `^(ts^)`。
- **判别**：括号里的内容跑到了下一行 / 报"此时不应有" ⇒ 就是它。
- **⚠️ 历史反转**：早期素材曾建议"避免用 `<>`，写成 `(ts)`" —— **那条建议本身有害**（正是它引入了本坑）。现规则：**`<>` 与半角 `()` 都不许出现在块内 `echo` 里**。
- **出处**：2026-09-19 实测修复 `scripts/upgrade-015/run-upgrade.cmd` L91 / L124（备份 `.bak-paren-20260919-225553`）。

### A2 `.cmd` 编码：GBK + `chcp 936`（**不是** UTF-8 + 65001）

- **症状**：UTF-8 + `chcp 65001` 的中文 `.cmd` 报 `'??' is not recognized as an internal or external command`（`^` 转义与三字节中文错位，后一行被切碎）。
- **正解**：**GBK 编码 + `chcp 936`**；若脚本本身无中文，纯 ASCII + `chcp 65001` 也可以（中文交给 node 输出）。
- **判别**：报错里出现 `??` 或"不是内部或外部命令"且行号对不上 ⇒ 先怀疑编码。
- **出处**：2026-09-17（当前态文档 §9 原条目）；2026-09-19 `mnemon-write-*.cmd` 以"纯 ASCII + chcp 65001 + 中文由 node 输出"通过实测。

### A3 不要用 stdin 喂交互式 `.cmd`

- **症状**：`printf 'S\nQ\n' | cmd //c x.cmd` 或 `< /dev/null` ⇒ 卡在 `set /p` / `pause`，或让 cmd 进入**交互模式**（把输入当命令执行，报 `'S' 不是内部或外部命令`）。
- **正解**：① 想测菜单用**字节重定向**：`cmd /c "x.cmd < in.txt > out.bin 2>&1"`（`in.txt` 用 node 写成 `\r\n` 结尾）；② 输出是 GBK，用 `new TextDecoder('gbk')` 解码；③ 更好的做法：给脚本加**非交互冒烟开关**（`--smoke`）。
- **出处**：2026-09-19 测 `run-upgrade.cmd` 菜单。

---

## 三、B. Shell 与路径（bash / MSYS / PowerShell）

### B1 `cmd //c` vs `cmd /c`：MSYS 路径转换的双面性

- **症状**：Git Bash 里 `cmd //c x.cmd` 正常（`//c` 被 MSYS 转成 `/c`）；但**加了 `MSYS_NO_PATHCONV=1` 后 `//c` 不再转换** ⇒ cmd 收到非法参数 ⇒ **进入交互模式**。
- **正解**：二选一，**别混用** —— ① 不加 `MSYS_NO_PATHCONV` 时用 `cmd //c`；② 加了 `MSYS_NO_PATHCONV=1` 时用 `cmd /c`。
- **同类坑**：`VBoxManage guestcontrol … --exe /bin/bash -- -lc "…"` **必须加 `MSYS_NO_PATHCONV=1`**，否则 `/bin/bash` 被转成 `C:/Program Files/Git/usr/bin/bash`（VM 里不存在）。
- **出处**：2026-09-19（VBoxManage 回函拷贝、菜单冒烟测试各踩一次）。

### B2 ⚠️ 危险命令不要用 shell 变量（会指到根目录）

- **症状**：`STAGE=…; for d in data documents runtime; do rm -rf $STAGE/$d …` 在 `&&` 长链中变量未生效 ⇒ 实际执行 **`rm -rf /data /documents /runtime`**（MSYS 的 `/` = Git 安装目录）。
- **根因**：长 `&&` 链 + 变量赋值混排时极易丢变量；MSYS 下 `/xxx` 指向 Git 安装根。
- **正解**：危险路径**一律写全绝对路径**（`rm -rf <工作区>/xxx/data`），或先 `echo` 预演一遍；关键删除前先 `ls` 确认。
- **判别**：命令里出现 `$VAR/` 且以 `rm -rf` 开头 ⇒ **停下来改写成绝对路径**。
- **出处**：2026-09-19（本次因无权限未造成破坏；Git 目录已核查完好）。

### B3 Git Bash 里多层反斜杠转义不可靠

- **症状**：要匹配 `<工作区>\文档` 时，`grep 'dss\\文档'`、`node -e "'…\\\\文档…'"` 会被层层吃掉，最终变成 `F:dss文档` ⇒ **统计结果假 0**。
- **正解**：把带反斜杠的逻辑写成**脚本文件**（用 write 工具），脚本内用 `String.fromCharCode(92)` 拼反斜杠，**避开任何 shell 转义**。
- **判别**：明明该有命中却全是 0 ⇒ 先怀疑转义。
- **出处**：2026-09-19（路径统一统计首轮全部报 0）。

### B4 ⚠️ MSYS 的 `iconv | sed` 管道会**悄悄吞掉 `\r`**

- **症状**：改一个 GBK + CRLF 的 `.bat` 里的路径：`iconv -f GBK -t UTF-8 | sed 's#…#…#' | iconv -f UTF-8 -t GBK > tmp && mv tmp 原文件` ⇒ **替换没生效**，而且**整文件从 CRLF 变成纯 LF**（直接踩了"`.bat` 必须 CRLF"的铁律）。
- **正解**：**GBK 文件的读写一律走 pwsh**（`[IO.File]::ReadAllText($p,[Text.Encoding]::GetEncoding(936))` → `-replace` → `[IO.File]::WriteAllText(…)`），顺手把换行统一成 `` "`r`n" ``；改完**必须校验** `CRLF` 个数与 `bareLF`（期望 **`bareLF=0`**）。
- **推论**：**跨编码 + 跨换行规则的文本改写，不要拿 MSYS 文本工具链赌**。
- **出处**：2026-09-20 实测（修 `启动修仙模拟器.bat` 时踩到，改用 pwsh 修回 `CRLF=60 / bareLF=0`）。

---

## 四、C. 编码（GBK / UTF-8）

### C1 读 GBK 文件：node 的 `TextDecoder('gbk')` 可用

- `new TextDecoder('gbk').decode(fs.readFileSync(p))` —— **Node 18+ 内置**，无需 iconv。

### C2 写 GBK 文件：node **做不到**，走 pwsh

- Node 的 `TextEncoder` **只输出 UTF-8**，且 DSH profile 里**没有 iconv-lite**。
- **正解**（.NET 保原编码）：
  ```powershell
  $enc = [Text.Encoding]::GetEncoding(936)
  $t = [IO.File]::ReadAllText($p, $enc)
  $t = $t.Replace('旧', '新')
  [IO.File]::WriteAllText($p, $t, $enc)   # 保留原编码
  ```
- ⚠️ `[IO.File]::WriteAllText` **不会**改动行尾（CRLF 原样保留）；改完仍要复核"是否含目标字节 / 是否仍 CRLF"。

---

## 五、D. 浏览器自动化（pilot / React）

### D1 React 受控组件**不能**用 JS `click()`

- **症状**：`el.click()` 看起来成功，但 React 的 `onClick` 不触发 ⇒ **改动静默丢失**。
- **正解**：用 `pilot_click`（CDP 真实指针事件）。**判别：操作后回读数据核对**。

### D2 绝不能对 React 受控组件 `removeAttribute('disabled')`

- **后果**：破坏 React 内部状态 ⇒ 对话框**永久卡死**（按钮全 disabled，`click()` 与 `Escape` 均无效，**只能刷新页面**）。曾在「移除记忆」对话框踩到。

### D3 复选框：`snapshot` 的 `on` ≠ 已勾选

- `on` 只是 HTML `value` 属性，**不代表勾选状态**。
- **正解四步**：`pilot_eval` 只读探 `checked`/`disabled` → `pilot_click` 真实点 → **复查 `checked===true`** → 才点确认。
- **出处**：2026-09-19（3081「启用 Full access」确认框；97 号派工前）。

### D4 pilot 点击优先用 snapshot 的 **ref**，别用 CSS 猜

- **症状**：用 `[role=dialog] button:last-child` 点"启用 Full access" ⇒ **静默点到「取消」**（对话框关了、模式没变，最容易误判成功）。
- **正解**：用 snapshot 给出的 `[63] 启用 Full access` 这类 **ref**；点完**必须回读状态**（如访问模式按钮文案），**不能以"对话框关闭"当成功**。

---

## 六、E. 数据与脚本安全

### E1 读 JSON 字段前必须确认字段名存在

- **症状**：脚本按 `r.keep` 取值，而实际结构里只有 `keepTag` ⇒ `undefined` 参与分组 ⇒ 崩在半途，**且已把 1 条记录误软删**。
- **正解**：取值前 `console.log(Object.keys(第一个元素))`，或写 `?? 报错退出`；**先 dry-run 打印将改动清单，再 apply**。
- **出处**：2026-09-19 `dup-batch2.mjs`（已从备份 + 软删内容恢复并重跑）。

### E2 输出重定向别把错误也吞掉

- `node x.mjs 2>/dev/null` 会**连崩溃原因一起吞**，导致误判"没输出＝没改"。**诊断阶段一律 `2>&1`**。

### E3 `node:sqlite` 直写软删的语义（mnemon 空间库）

- provider 软删 = `deleted_at` 与 `updated_at` **同写**同一 ISO 时间戳（无毫秒，如 `2026-09-19T13:14:48Z`）；活跃条目判定 = `deleted_at IS NULL`。
- 直写后**必须**：① 把该条 `embedding` 置 NULL 并回填（内容变了则向量失效）；② 同步 `60-ops\mnemon-staging\host\`（否则开机合并回滚）。

### E4 长任务 / 大输出：先 dry-run，再 apply，再核对

- 我们所有批量改记忆 / 文档的脚本都遵循：**冷备份 → dry-run 打印清单 → apply → 逐项核对（计数 / 残留 / 抽查）→ 同步 staging**。实测**零返工**。
- 这条是**方法论级**的：任何"一次改很多文件/记录"的活儿都照此办。

---

## 七、G. DSH / mnemon 口径

### G1 `mnemon_status` **不返回**上限字段

- 它只吐 `healthy / version / commandFound / writeEnabled / memorySpaces / providers / aggregate`；拿不到 `memoryLimitBytes / userLimitBytes`（其中的 `version` 还是**原生 CLI** 版本，不是插件版本）。
- **验收上限的三件套**：① `settings.yaml` 的 `mnemon.runtimeMemory` 段；② **本轮注入头的分母** —— `Contents of MEMORY.md (… UTF-8 bytes: 13423/32768)`，那是**正在跑的进程**读到的生效值，**最硬**；③ 源码行号。
- ⚠️ 对拍注意：注入头里的 `used` 比磁盘文件**小 1 字节**（不含文件尾 `\n`），别误判成"少了一条"。

### G2 `[dsh-mnemon] idle review failed: memory subagent completed without recording its result`

- **机制**：mnemon 的**空闲审查**（`idleReview`：默认开、空闲 30 s 触发、`minIntervalMs` 5 min、`maxPerSession` 20）会 spawn 一个记忆子代理去沉淀记忆，子代理**必须经 `mnemon_subagent_result` 回报**结构化结果。
- **判据/打印**：`dsh-mnemon/lib/index.js:4513`（`stopReason=completed` 但 `structured===undefined` ⇒ 抛错）、`:5580`。
- **实测两侧都有**（主机 12 次 / VM 4 次，均 0.5.10）⇒ **插件侧共性问题**，非环境问题；**零副作用**（失败即丢弃、不写任何东西），代价只是白跑子代理 + 日志噪音。
- **上游**：PR「fix(review): bound idle reviews and pause incompatible Agent Teams」（#257）等；最新 **0.5.12** 的 peer 是 `^0.1.5-rc.1 || ^0.1.6-alpha.2`（**0.1.5 宿主可升，0.1.1 宿主不行**）。

### G3 DSH 工作区：会话归属由**会话自己的工作目录**决定

- `dsh-workspace` 只列出 `sessionPath(id) === record.path` 的会话 ⇒ **历史会话搬不到别的工作区**（0.1.5 没有该功能；`workspaceDropBefore/After` 只是**区内排序**）。
- 新建工作区后，**在该目录里新开的会话**才归它；旧会话留在原工作区（要清爽就归档）。会话文件按 cwd 分目录，**搬迁项目目录不影响它们**。
- **别手改 `workspace.json`**（domain v2 + 运行时内存态 + `global.workspaceIds` 顺序）；GUI 有 `Add workspace… / Rename / Delete`。

### G4 pilot 操作 GUI 的两个省力技巧

- **不必每次 snapshot**：在 `pilot_eval` 里按文本 / `aria-label` 精确挑出元素并 `el.id='xxx'`，再用 `pilot_click({selector:'#xxx'})` —— 输出小、定位准（这不算"用 CSS 猜"，依据仍是精确文本）。
- **对话框按钮消歧**：同类按钮有多个（列表里的"移除" vs 对话框里的"移除"）时，用「**祖先链里是否含特征文本**」（如"无法撤销"）判定，比按位置猜可靠。

---

## 八、H. DSH 插件开发与上线

> **本章主题**：写/装/升插件之后出现的怪现象 —— GUI 打不开、改了不生效、命名空间看不见。
> **来源**：01 号 §4 / §5 / §11、05 号全文、15 号「最终结果」、17 号 §5.2、12 号「破坏性/注意」。

### H1 客户端 bundle 缺 `exports.inject` ⇒ 整个 GUI 打不开（最严重）

- **症状**：新增 client.js 后重启，GUI 全灭，只剩 `Failed to load plugins` / `Failed to apply loader entry …: cannot get property 'slots' without inject`；**DSH 进程本身活着**，只有 Web 界面完全不可用。
- **根因**：cordis 客户端对 `ctx.<服务名>` **属性访问**强制检查插件 `inject` 白名单；client.js 只导出 `apply` 没导出 `inject` ⇒ apply() 启动即抛错 ⇒ loader entry 激活失败 ⇒ 整个 web UI 起不来。
- **正解**：导出形状 = `{ inject: [服务名…], apply }`，**缺一不可**；`ctx.get("slots")` 拿局部变量再调用不受门控（受门控的是 `ctx.slots` 这种属性访问）。
- **判别**：报错里出现 `without inject` ⇒ 直接查那个插件的导出形状，**不用逐个撤插件试**。
- **出处**：01 号 §4.1（L135–152）、§5.1（L252–263）。

### H2 表单对象缺 `subscribe` ⇒ 页签内容区变 slot-error

- **症状**：dev 实例里页签出现，但内容区显示 slot-error 占位（渲染期异常被插槽系统捕获隔离，不炸整页）。
- **根因**：组件里调 `form.subscribe(...)`，而 createForm 返回的对象没有 `subscribe` 方法 ⇒ undefined 调用。
- **正解**：createForm 返回 `{ shell, field, subscribe, edit, resetField, discard, save }`；组件用到的每个方法先确认存在。
- **判别**：harness 只测到 apply 注册为止（`createElement` 不执行组件体）⇒ **渲染路径必须真机（dev 实例 :3090）验证**，别拿 harness 绿当通过。
- **出处**：01 号 §4.2（L154–162）、§6 清单（L303）。

### H3 渲染循环里用 `var` ⇒ 多个控件的值互相串

- **症状**：改"引擎"下拉，"超时"字段冒出非法值（红字"请填数字"）。
- **根因**：`for (var i…) { var spec = FIELDS[i]; … onChange: () => form.edit(spec.field, …) }` —— `var` 是函数作用域，7 个 onChange 闭包全捕获**同一个** spec（循环结束后的最后一个）。
- **正解**：`var` → `let`/`const`（块级作用域，每轮迭代独立捕获）。
- **判别**：多个同类控件互相串值 ⇒ 先查循环闭包；这类 bug harness 模拟不了事件，只能真机点出来。
- **出处**：01 号 §4.3（L164–173）。

### H4 api-proxy 硬编码白名单 ⇒ 新命名空间客户端永远看不到

- **症状**：插件明明启用了、命名空间明明注册了，客户端 describe 里永远没有它 ⇒ 页签显示"命名空间不可用"。
- **根因**：宿主 `packages/host/apiproxy/src/api-proxy.ts` 有硬编码 `WEB_SETTINGS_NAMESPACES` 白名单；不在名单里的命名空间对客户端一律答 `settings-not-exposed`（源码注释原话：*adding a section to that page is a decision made here*）⇒ **插件自己注册配置节也没用**。
- **正解**：加进白名单，且**源码与 `lib/index.js`（编译产物）两处都改**（harness 是编译产物驱动）；改完重启。
- **判别**：宿主进程 `settings.describe({})` vs 客户端 describe **对比差异**，少掉的那一个就是被过滤的命名空间。
- **出处**：01 号 §4.4（L175–198）。

### H5 pnpm `file:` 目录依赖不刷新（跨盘真复制 / 版本号不变静默跳过）

- **症状**：改了插件源码，跑起来还是旧行为（老代码仍在生效）。
- **根因**：① `file:` 依赖**同盘 = 硬链接**（内容实时跟随源码）；**跨盘（C: profile ← F: 源码）= 真复制**，改源码不自动同步；② **版本号不变 → pnpm 直接 "Already up to date"**，`pnpm add --force` 也不会重新复制（静默跳过，退出码 0）。
- **正解**：唯一可靠触发重复制 = **版本号 +1**（或删掉 node_modules 里的副本再装）；我们刷新脚本 v2 已改成"自动递增版本号 + xcopy"，绕开 pnpm。
- **判别**：改完源码没效果 ⇒ 先比对 node_modules 副本与源码的内容/mtime，**别怀疑自己刚写的代码**。
- **出处**：01 号 §5.2（L265–270）、§4.5（L203）。

### H6 别用 `dsh plugin add` —— 它会改写 `cordis.patch.yml`（改了又坏）

- **症状**：启动报 `duplicate loader entry id: dsh-expression`；手动改好的 patch 过一会儿又变回旧内容，甚至出现注释行尾丢换行、``生效` 与 `- id: ssh`` 粘连 ⇒ YAML 解析失败、**所有 disable 一起失效**。
- **根因**：`dsh plugin --profile web add <包名>` 安装时会自动改写 profile 的 `cordis.patch.yml`、追加 insert 块、**覆盖手动编辑**（GitHub #1404 已知 bug）；插件 bundle 自带 `dsh.bundle.patch` 也会 insert 同 id ⇒ 重复 ID。
- **正解**：① 装插件不用 CLI；② profile patch **只写 disable**（ssh / remote-web-ui / pet 等）；③ 插件自带 bundle.patch 的（如 dsh-meme）**不要再手写同 id insert**；④ 第三方插件手写 insert 条目；⑤ 改完尽快重启（DSH 运行中程序会把文件写回）。
- **判别**：patch 文件"改了又坏" + 乱码粘连 ⇒ 就是这个 bug；顺手查它是否为 UTF-8 无 BOM。
- **出处**：01 号 §11（L623–643）、05 号 §1 / §2（L12–14、L43）。

### H7 依赖 `@deepseek-ai/dsh-tools` 的第三方插件 ⇒ 所有工具调用崩

- **症状**：装完某插件后，**每一次工具调用**都报 `Cannot read properties of undefined (reading 'prepare')`。
- **根因**：该插件依赖 `@deepseek-ai/dsh-tools`（与宿主内部模块不兼容）；deepseek-harness Discussion #1697（open，官方未确认修复）。
- **正解**：装前先看插件 `package.json` 是否依赖该包；遇到这个报错**优先排查刚装的插件，而不是怀疑宿主**。
- **判别**：报错文本固定含 `reading 'prepare'` + 时间上紧跟一次插件安装。
- **出处**：05 号 §7（L72–77）。

### H8 插件装配三件事：junction、presets 一级目录、装完必重启

- **症状**：预设类插件装了，但新会话的预设选择器里看不到；或删/装插件后 GUI 白屏。
- **根因**：① profile 的 node_modules 靠 **junction** 指到工作区源码；② DSH **只扫 `.agent-presets` 的一级子目录**，`agent.cordis.yml` 必须直接位于预设目录内（多套一层就扫不到）；③ 插件注册表在**进程内存**里，删/装后不重启 → 旧进程仍引用已删除的 client.js ⇒ 前端请求 404 ⇒ 白屏（**服务进程本身健康，只有页面挂**）。
- **正解**：`mklink /J C:\Users\<USER>\.dsh\profiles\web\node_modules\@dsh-external\<包名> <工作区>\<插件名>`；预设**平铺**到 `~/.dsh/.agent-presets\<预设名>\`；装完 `<工作区>\scripts\dsh.cmd restart`（VM 侧 `systemctl --user restart dsh-web`）；卸载删 junction 用 `rmdir`（**别用 `del /s`**，见 F5）。
- **判别**：装了没生效 ⇒ 先看目录层级 + junction 指向，再问"重启了没"。
- **出处**：05 号 §2（L16–34）、§5（L54–63）、§6（L65–70）、01 号 §4.6（L205–231）。

### H9 插件与宿主版本不匹配（peer 范围 / keyed-slot / 皮肤冲突）

- **症状**：① 发消息报 `Cannot read properties of undefined (reading 'filter'/'some')` + 「本轮运行失败」；② 升级宿主后全家桶起不来（启动失败）；③ GUI 页面一闪而逝。
- **根因**：① 插件 peer 依赖范围不含当前宿主版本（mnemon 0.2.15 止于 `^0.1.1-rc.1`，宿主是 0.1.2-rc.1）⇒ 会话 UI 注入路径对 undefined 调 `.filter`；② DSH rc.6 起有 settings **keyed-slot 检查**，全家桶 <0.1.18 会启动失败（**此子项来自升级方案的"破坏性/注意"，我们未实测踩到**）；③ 两个皮肤插件共存冲突（maid vs skin-center）。
- **正解**：装/升插件前核对 peer 声明范围；升到适配线（mnemon 0.5.5 实测通过）；全家桶整体升到 0.3.17 一并解决；皮肤**只留 maid**，撤下 skin-center（disable）。
- **判别**：报错含 `filter`/`some` 且刚升级宿主或刚装插件 ⇒ **逐个撤下验证定位**；我们曾把它误归因给聚合包 / UI 类插件（悬置部分见 F6）。
- **出处**：15 号 §最终结果与后续经验（L73–83）、17 号 §5.2（L119–120）、12 号 §破坏性/注意（L33–34）、_归档/审计-2026-09/记忆审计-2026-09-11.md（L135）。

### H10 `package.json` 与 `node_modules` 必须同步（配置与依赖要成对）

- **症状**：启动报 `cannot resolve profile bundle X`；或"装完了版本却没变"（install 之后行为照旧）。
- **根因**：① package.json 的 `dsh.profile.bundles` 里列了 X，但 node_modules 里**没有** X；② 版本切换时**跳过完整 `pnpm install`** ⇒ package.json 与 node_modules **伪一致**（看着改了，实际没装）；③ 若"版本没变"而两处版本号一致，那多半是 `--patch` 被 settings 压制或装错目录（见 J3）。
- **正解**：**配置与依赖必须成对**（改 `package.json` 紧跟 install，失败要能还原）；**每次版本切换必须完整 `pnpm install`，不得跳过**；验收时对拍 runtime `package.json` 与 node_modules 里的**实盘版本号**是否一致。
- **判别**：报 `cannot resolve profile bundle` ⇒ 要么装上 X，要么从 bundles 移除；"装了没变" ⇒ **先对拍两处版本号**，别先怀疑代码。
- **出处**：17 号 §5.2（L117、L122）、15 号 §三 注（L38）与最终结果（L83）、事故/25-会话交接-新会话开篇必读.md（L110）。

### H11 别乱升级全家桶：新版本**删子包** ⇒ 整个 GUI `Failed to load plugins`

- **症状**：升级 `@linxin666/dsh-web-ui-all` 0.1.18 → 0.2.0 后，整个 GUI 打不开，报 `Failed to load plugins`。
- **根因**：新版本**删掉了 `dsh-live-stats` 子包**，而客户端清单里**仍引用它的 client.js** ⇒ 加载失败；同类事故 0.2.9 又炸过一次（主机 / VM 各一次）。
- **正解**：**别乱升级全家桶**（升级前先看 release 是否删包）；已炸用回滚脚本 `脚本\rollback-webui-0118.cmd`；要升就整体升，并先在 dev 实例（:3090）验证。
- **判别**：升级全家桶后 GUI 全灭 + 报 `Failed to load plugins` ⇒ 先查新版是否删了 bundles 里列着的子包。
- **出处**：01 号 §4.5（L202）、§4.6（L211）、§6 清单（L308、L313）。

---

## 九、I. 会话数据、升级与恢复

> **本章主题**：会话打不开 / 报 torn / 报 range 错时，**先分清"数据损坏""语义不兼容""工具误报"**，再决定动不动刀。
> **来源**：08 号全文（含 15 条教训）、01 号 §10.7 / §10.10、17 号 §5.2 / §7.4、事故/25、事故/30、审计/00-当前态.md。

### I1 会话打开报 `lacks an identified message`（缺消息 id）

- **症状**：项目会话打开报 `SessionPersistenceCorruptionError: session event at seq 84914 lacks an identified message`。
- **根因**：该 seq 是 `tool-goal` 插件的 goal 收尾通知（`<goal_blocked>`）写入的 `user/message` 事件，**缺 `data.id`**；DSH 加载时 `assertMessageEventShape` 要求非空 id，而 `migrateLegacyMessageEvent` 只迁移"无 role 无 id"的旧格式，对"有 role 但无 id"的过渡形状直接放行 ⇒ 校验拒绝 ⇒ **整会话判损**（全量扫描 199 会话仅此 1 处）。
- **正解**：解码全部帧 → 定位坏事件 → 补 UUID id → **逐帧重压**（checksummed zstd，帧边界不变，只重压目标帧）→ `validate-session.mjs` 全绿 → GUI 验证历史完整渲染。
- **判别**：报错点名 seq + "lacks an identified message" ⇒ 缺 id 类，走 `repair-session.mjs`。
- **出处**：08 号 §1（L23–29）、§4 流程（L86）。

### I2 压缩完整 ≠ 文件健康（判定要四项一起）

- **症状**：zstd 帧完整、全量 `JSON.parse` 合法、帧没切行、多帧格式正常 —— 常规检查**全部通过**，GUI 仍报 `torn JSONL record` 或 `invalid current range`。
- **根因**：损坏位点在**语义层**（seq 连续性 / turn 平衡 / 消息 id / 引用有效性），不在压缩层。
- **正解**：按帧解析 + seq 连续 + turn 平衡 + 消息 id 逐项校验（`validate-session.mjs` 是首选定位工具）。
- **判别**：压缩类校验全绿但 GUI 打不开 ⇒ 立刻上语义校验，**别在压缩层反复折腾**。
- **出处**：08 号 §6 教训 2（L125）、§2 排查排除项（L40）。

### I3 headless 写入器系统性损坏 ⇒ 每个长任务结束都要跑修复

- **症状**：GUI 打开 headless 派工会话报 `corrupt Zstandard session log complete frame contains a torn JSONL record (internal)`。
- **根因**：headless 写入器跨 turn 的 chunk 流 seq **回退 1–2 个**（本会话 2354 处）+ 偶发重复 `turn/end`（1 个 start 对 2 个 end）；**不是单发事故**：10 个 headless 长任务会话 4 个损坏。
- **正解**：删非末尾的 `turn/end` → **seq 全量连续化** → 按原帧分组重压（帧边界不变）→ 校验；已固化为 VM `~/bin/fix-session.sh`，**headless 长任务结束后必跑**，再让 GUI 打开。
- **判别**：headless 会话 + 报 torn ⇒ 直接上修复，不要先怀疑会话太长或引用链。
- **出处**：08 号 §2（L31–49）、§6 教训 1（L124）、01 号 §10.7（L559）。

### I4 运行中的 headless 会话报 `seq gap` 属预期

- **症状**：同一批任务里，**跑完的会话能加载，还在跑的报** `corrupt session log: seq gap`。
- **根因**：运行中 log 持续追加，前端此时打开会撞上**未完成帧**。
- **正解**：验收纪律 = **运行中不点开会话**，任务结束 + `fix-session.sh` 修复后再验。
- **判别**："跑完能开、在跑报错"是正常现象，不是数据损坏 ⇒ 别去修。
- **出处**：01 号 §10.10 末段（L617–619）、08 号（同源）。

### I5 报 `invalid current range` / `no adjacent shadow price` 是语义不兼容，**不是**损坏

- **症状**：GUI 报 `live-stats: replace at seq 393392 has invalid current range 314643-149996`；换个宿主重试又报 `token surface: replace … has no adjacent shadow price`。
- **根因**：① compaction 摘要**回插**导致 range 端点数值反转（表面序 ≠ seq 数值序，**官方合法**：第二次 compaction 按表面序记录折叠区段端点，数值上 start>end）；② **shadow-price claim 必须与紧邻 replace 逐字段一致**，只改 replace 不改 summary 就报第二类错。
- **正解**：先用官方 `foldSurface` 全量回放判定自洽 —— **自洽 = 语义不兼容，做兼容性修补，绝不删事件**；改 replace 的 `surfaceOp.start` 必须**同步改配对的 `compaction/summary.shadowedRange.start`**；新起点选"原折叠区段内、表序紧邻摘要的普通 append 节点"（区间基本不变、数值有序、官方语义仍通过）；改完用 `verify-claim.mjs` 复现/验证。
- **判别**：官方全量回放**通过**而宿主报错 ⇒ 是回放语义差异，不是数据损坏。
- **出处**：08 号 §3（L51–78）、§6 教训 7 / 8（L130–131）。

### I6 判"损坏"的工具本身会误报（`official-fold.mjs` 绕过持久化层）

- **症状**：工具报 `sourceEventSeqs must densely contain non-negative safe integers`，但同一文件在宿主加载路径下**健康**（551 表面节点 / 5 次 replace 全通 / seq 严格连续）。这条假判据曾导致**健康会话被主动弃用**。
- **根因**：0.1.2 起 `sourceEventSeqs` 在**磁盘上**是无损区间编码（`[1,2,3,7,8,9]` → `[[1,3],[7,9]]`），读盘时由 `decodeSeqRanges` 展开；`official-fold.mjs` 把磁盘原始行**直接喂给内存层 `foldSurface`**（跳过了持久化解码）⇒ 对健康会话**必然误报**（任何版本都一样）。
- **正解**：判"损坏"用走**宿主真实加载路径**的 `dsh-session-verify.mjs`（`decodeSeqRanges` → `decodeStorageRecord` → `foldSurface` + claim 重放 + 帧/seq/消息 id/事件词表/turn 全检，单文件 + `--scan` 全库两模式）。
- **判别**：报 `densely contain` **且**该会话由 0.1.2 系写过（含区间编码）⇒ 先怀疑工具，**别动文件**。
- **出处**：08 号 §6 教训 12（L138）、§7.1（L151–154）、§0（L20–21）。

### I7 写会话与读会话必须 ≥0.1.2 同代（禁止回滚到 0.1.1 系）

- **症状**：同一份会话文件，**旧读方 FAIL（报 `densely contain`）、新读方 PASS**。
- **根因**：`0.1.1-rc.2` **没有** `decodeSeqRanges`，读 0.1.2+ 写的会话会逐个报同一个假错；`0.1.2-rc.1` 写盘压区间 + 读盘展开（区间编码是这一系独有特征）；`0.1.5-rc.1` 改用 v1 schema codec **不写**区间编码，但**能读**旧会话。
- **正解**：**禁止把主机回滚到 0.1.1 系**；确需回滚先用 `dsh-normalize-storage-form.mjs` 对**副本**展平那 53 个含区间编码的会话（+4.2% 体积、语义零变化、已双向验证）；升级/回滚验收加一条 `dsh-session-verify.mjs --scan` 全库扫描。
- **判别**：`densely contain` 的充要条件 = 「0.1.2+ 写盘」+「读方没做存储解码」，**与体积/轮次无关**（1 KB 的新格式会话同样会被旧读方判"损坏"）。
- **出处**：08 号 §6 教训 13 / 14（L139–143）、§7.5（L179–183）。

### I8 seq 连续化必须同步 `sourceEventSeqs` 引用（校验器查不出这项）

- **症状**：seq 重排修复"通过"了，GUI 打开却报 `invalid seed event … sourceEventSeqs must reference earlier events`。
- **根因**：chunk 记录的 `sourceEventSeqs` 数组引用**旧 seq**，全量重排后引用失效；而 `validate-session.mjs` **不校验这一项**。
- **正解**：修复必须带 **oldSeq→newSeq 映射表**同步转换（`fix-session-core.js` v2 已含）；全量检查用 `refcheck2.js`（bad 数 >0 就从原始 `.bak` 重做）。
- **判别**：seq 修完 GUI 还报 seed 引用错 ⇒ 查引用表同步，而不是再排一次 seq。
- **出处**：08 号 §6 教训 6（L129）。

### I9 多轮修复用**独立备份名**（同名备份会被下一轮覆盖）

- **症状**：两轮 patch 都用了 `.bak-pre-repair`，第二轮把第一轮的状态覆盖掉 ⇒ 磁盘上只剩**中间态**。
- **根因**：同名备份 + 多轮修补。
- **正解**：备份名带序号（`.bak-1` / `.bak-2`）+ 记 sha256，保证任何一步都能回退；修复前必备份、修复后全量扫描同类问题。
- **判别**：准备第二轮修复前先 `ls` 一下备份名是否已存在。
- **出处**：08 号 §3 ⚠️教训（L78）、§6 教训 10（L133）、§4 流程（L83）。

### I10 fork 血缘会让"谁的问题"算错 ⇒ 边界判据必须是 header `seedLength`

- **症状**：统计得出"某会话 16 处反转"，做完血缘去重后真值是**自有 3 / 继承 13**；早期甚至得出"自有 16 / 继承 0"的假象。
- **根因**：fork 子会话按**原 seq 逐字复制**父会话事件 ⇒ 父的 compaction 与反转会原样出现在子会话里；早期用「**最早一条 `session/end-seed` 的 seq**」当 fork 边界 —— **错**：seed 里本就含父会话自己的多条加载标记（本案 27 条，最早在 seq 107,329），于是边界被算成 107,329 而不是真正的 fork 点（4xx,xxx），大量继承事件被误算成"自有"。
- **正解**：边界判据用持久化 header 的 **`seedLength`**（= 运行时 `inheritedEventCount`，官方注释 *the DURABLE fork-lineage cut*；根会话无此字段 ⇒ 边界 0）；统计用 `dsh-session-audit.mjs --lineage`；**修父会话后按 `parentSession=<id>` 扫出受影响子代理一起修**。
- **判别**：修复/统计数字与预期差一个量级 ⇒ 先问"这些事件是不是 fork 继承来的"。
- **出处**：08 号 §7.4（L171–177）、§6 教训 9（L132）。

### I11 扫描类证据三原则（`file` 字段 / 单会话隔离 / 自产 vs 继承）

- **症状**：把 `scan-reversed.mjs` 的输出当成"**本会话**有 12 处反转"，还把别的会话的数字串了进来（26 号文档实际这么错过）。
- **根因**：该脚本**默认扫全库 ≥1.5 MB 的所有会话**，stdout 是**混着多个会话**的 JSON 数组；一条"看起来很具体"的命中其实不属于你问的那个会话。
- **正解**：① **必须保留 `file` 字段**（任何命中都要能追溯到具体会话文件）；② **必须做单会话隔离**（跨会话混扫的输出不得直接当作某个会话的证据）；③ **必须区分"自产"与"继承"**（血缘去重，判据见 I10）。
- **判别**：脚本的"默认范围"大于你问的范围 ⇒ 先隔离、再引用它的数字。
- **出处**：08 号 §6 教训 15（L144）、§5 工具表（L115）、事故/30-事故四结案报告.md §二（L48）。

### I12 长会话纪律：>30 万 token 或 `compaction/summary` ≥2 次就换新会话

- **症状**：大会话打开变慢（实测 8.5 MB / 51.2 万事件全量加载 ≈ **3.2–3.5 s CPU + 0.6 GB 峰值内存**，解压+解析占 ~95%），多会话并存叠加；且 compaction range 反转只出现在这类会话里。
- **根因**：长会话是 compaction 的**病理温床**：反转处数 = `summary` 数 − 1（4/4 样本验证；`compaction/prune` 是单节点替换，**永不反转**）；性质是"资源开销 + 病理位点"，**不是**"引用链损坏"。
- **正解**：会话上下文 >30 万 token（≈3 MB 会话文件 / 约 30–50 轮），或单会话 `compaction/summary` ≥2 次，**就主动开新会话**（硬线：compaction ≥3 次或文件 >5 MB）。**先换后修**：换会话成本≈0，修复要停服、要备份、要在损坏文件上动刀。
- **判别**：看 `summary` 次数与会话文件体积，别凭"轮次感觉"。
- **出处**：08 号 §6 教训 11（L134–137）、§7.6（L185–187）、01 号 §6 清单（L316）、事故/25-会话交接-新会话开篇必读.md（L102）。

### I13 改活动会话文件前必须停服（在线改会被写回）

- **症状**：在线修完会话文件，症状**立刻复发**（或修复根本没落盘）。
- **根因**：活动会话文件由 DSH 进程持有并持续写入，**不能在线改写**。
- **正解**：修复脚本执行前先 `<工作区>\scripts\dsh.cmd stop`（**由你手动执行**——agent 杀宿主等于杀死自己的执行环境）；VM 侧用 `systemctl --user restart dsh-web`；修完再起。
- **判别**：修完立即复发 ⇒ 先确认服务是否还在跑（`dsh.cmd status` / 端口）。
- **出处**：事故/25-会话交接-新会话开篇必读.md（L89）、17 号 §5.1（L109）、§三 铁律（L36）。

### I14 升级脚本的幂等与账本：重走步骤不会重做，重跑初始化会清零

- **症状**：① 想"重走 `[3][4]`"却没有重做（`upg-03a` 已 `swapped` 直接跳过，两次 `upg-04` 的 `swapped` 都是 93 即证据）；② 重跑 `upg-00` 把账本**清零**（`swapped 93→0`、`bakPath` 全空）。
- **根因**：升级脚本按设计**幂等**（已 swapped 就跳过）；而初始化步骤负责重建状态账本。
- **正解**：要重做**只改 `state=pending` 不够**（03a 实测 `exit 6`：v0 已是修复件、sha 对不上阶段 0）⇒ 必须先用 `upg-86-fix-one.mjs` 把 phase-0 原件放回 v0，再跑 `[3][4]`；**新会话入账绝不能重跑 `upg-00`**，用脚本第 3 步 `--adopt-new` 补录，否则 C4b 全库总数必 FAIL。
- **判别**：脚本报"跳过"而你以为它会重做；或全库计数对不上 ⇒ 先怀疑账本被初始化过。
- **出处**：审计/00-当前态.md（L50、L62、L66）。

### I15 启动后浏览器 401 unauthorized（browser-session 认证）

- **症状**：DSH 起来后浏览器打开页面 401 unauthorized。
- **根因**：DSH **0.1.2+ 引入 browser-session 认证**。
- **正解**：用**启动窗口打印的带 token URL** 打开，或复用已有浏览器 cookie。
- **判别**：401 + 版本 ≥0.1.2 ⇒ 先找 token URL，别去改配置。
- **出处**：17 号 §5.2（L121）。

### I16 报错里的会话 id 可能被前端**截断**，别照着它找文件

- **症状**：按报错里的 id 去找会话文件，找不到（或找错会话、白排查半天）。
- **根因**：前端展示会**截断 id**（`c01eb21b` → `c0eb21b`，少一位）。
- **正解**：**先确认真实 id**（列 `~/.dsh/sessions/<工作区>/` 里的文件名，或按 mtime 取最近会话）再定位文件。
- **判别**：文件名与报错 id 只差一两个字符 / 少一位 ⇒ 是截断显示，不是文件缺失。
- **出处**：08 号 §6 教训 3（L126）。

---

## 十、J. VM / headless 派工与协同

> **本章主题**：把活派给 VM / headless 之后，"看起来成功"与"真的在推进"之间的那些坑。
> **来源**：01 号 §4.6 / §10.5–§10.10、02 号 §5.1 / §5.2、_归档/审计-2026-09/记忆审计-2026-09-11.md、审计/00-当前态.md。

### J1 headless 派工：任务文本禁 `-` 开头词，传参一律 base64

- **症状**：① 任务文本里写 `--oneline` 之类的词 ⇒ 报 unknown option；② guestcontrol 传的双引号被剥掉（`grep -E "a\|b"` 会炸）。
- **根因**：任务文本会先过 `dsh` 的**选项解析器**；命令行与 guestcontrol 层又会再做一次引号解析。
- **正解**：任务文本**描述写意图、不写具体命令**；文本/脚本一律 **base64 传输**（`echo <b64> | base64 -d > file`）。
- **判别**：报 unknown option，或脚本在 VM 侧被截断/语法错 ⇒ 先查是不是这两个传参坑。
- **出处**：01 号 §10.7（L555–556）。

### J2 headless 会话不进工作区注册表 ⇒ 前端「未分组」

- **症状**：派了工，3081 前端的工作区列表里看不到这些会话（显示「未分组」）。
- **根因**：headless 会话写入 `sessions/<projectKey>/` 目录（**文件层面归组**），但 `storages/workspace.json` 注册表**只有 GUI 新建会话才写**；另外 cwd 没 `cd` 进项目目录还会造出 title 空、path=`/` 的"幽灵工作区"。
- **正解**：派工命令**先 `cd` 到项目目录**（工作区绑定由**启动时的 cwd** 决定）；每批派工后跑 `node scripts/check-vm-sessions.mjs --fix-register`（自动备份 + 只追加）再校验；改注册表后需重启对应 DSH 实例生效（**请你操作**）。
- **判别**：前端「未分组」里冒出刚派的会话 ⇒ 就是没注册。**与 G3 的分工**：G3 讲"历史会话搬不进别的工作区"，本条讲"新会话压根没进注册表"。
- **出处**：01 号 §10.10 坑 2（L596–600）、§10.10 `--fix-register`（L613）、§10.7（L557）。

### J3 `--patch` 模型覆盖对 headless **无效**（settings 压过 patch）

- **症状**：派工命令带了 `--patch …/flash-model.yml`（修代码该用 flash），但会话 `request/header` 事件实测**全部 deepseek-v4-pro/high**。
- **根因**：`dsh-agent-default-model` 插件用 `installSettingsSection(..., { setSource })` —— **config 只是"无 settings 时的默认值"**；settings provider 存在时用 `settings.yaml` 的 `agent-default-model` 覆盖 config ⇒ **settings 永远压过 `--patch`**。`--dump-config` 显示 flash、运行时却用 pro，**两级真相互斥**。
- **正解**：模型分工要落实，只能改 VM `~/.dsh/settings.yaml` 的 `agent-default-model`（改前备份、重启 dsh 生效）；**只有 `request/header` 是地面真相**。
- **判别**：`--dump-config` 与实际模型不一致 ⇒ 查 settings 这一层，别改 patch。
- **出处**：01 号 §10.10 坑 1（L590–594）、02 号 §5.2（L118）、_归档/审计-2026-09/记忆审计-2026-09-11.md（L147）。

### J4 headless 不挂载 agent 预设 ⇒ 用前缀模板等价替代

- **症状**：headless 会话的行为不受 Router Standard / zh-code 约束；会话 header 里**没有 `agentPreset` 字段**。
- **根因**：`dsh-headless` 源码**不写 `agentPreset` 字段** ⇒ 预设插件永不挂载（**机制层面**，不是配置问题：实测装了插件 + 配了 default 也不触发）。GUI 会话则在创建时写入该字段（如 `"agentPreset":"zh-code"`）。
- **正解**：派工任务文本开头**固定注入行为要点模板**（工具按需调用 / 完成即停、交付门只跑一次 / 卡点先读仓库真实状态 / 汇报用证据不给结论）—— 模板见 01 号 §10.9。
- **判别**：`check-vm-sessions.mjs` 看 header 的 agentPreset **恒为 `(none)`** ⇒ 用 `--expect-preset any` 跳过，**别当成故障去修**。
- **出处**：01 号 §10.8（L564–570）、§10.9（L572–584）、§10.7（L561）。

### J5 headless 会话结束会回收派生的长驻进程 ⇒ 长驻服务交 systemd

- **症状**：派工任务起了 dev server，会话一结束服务就没了（端口断连）。
- **根因**：headless 会话结束会**回收其派生的长驻进程**。
- **正解**：长驻服务必须用 **systemd user service** 托管（示例 `xianxia-dev.service`；`systemctl --user restart xianxia-dev`，guestcontrol 会话里访问 user bus 需先 `export XDG_RUNTIME_DIR=/run/user/1000`）。
- **同类坑**：guestcontrol **只能跑一次性命令** —— `setsid nohup … &` 拉起的后台进程仍会在**会话结束时被 VBoxService 全部回收**（setsid 只脱离终端，躲不过 VBoxService 的会话清理）；对比 cron 起的进程（父进程是 cron）就一直活着。
- **判别**：服务"起了又消失" ⇒ 查它的父进程是谁。
- **出处**：01 号 §4.6 事故链第 2 条（L212）、§4.6 正解（L214–231）、§10.7（L560）。

### J6 后台在跑 ≠ 在推进（三查/四查必须一次做完）

- **症状**：① 页面"没动静"，但 dsh web 的 CPU 时间一直涨 —— 卡在上一个任务里死循环（同一句 Think 重复 6+ 次），新任务根本没被处理；② 任务看板全显示"待处理"，实际 `git log` 已有 5 个 commit。
- **根因**：进程存活、CPU 活动、甚至 git 新 commit **都不能证明当前任务在推进**（新 commit 可能是循环前的老进展）；任务看板的 localStorage 数据与 agent 的 `todo_write` 清单**不互通**。
- **正解**：发任务后必查（**缺一不可、一次做完**）：① 进程在跑 ② **最新 Think 轨迹是否变化**（同一条重复 3+ 次 = 死循环）③ 预期产物（commit / 未提交改动 / 端口监听）④ 消息真的进了对话流。**大任务拆小块**；卡循环 ≠ 工作白做 —— 先**抢救未提交代码**（`git status` → 跑测试 → 起服务验证 → 代 commit 收尾）再重挂新会话。
- **判别**：用"**预期产物是否出现**"判断健康，**不用**页面滚动/响应速度判断。
- **出处**：01 号 §10.5 / §10.6（L489–535）、02 号 §5.1 第 2 条（L101）。

### J7 "消息已发送"是假验证（`innerText` 检查作废）

- **症状**：汇报"已派工"，实际消息文本**还滞留在 `textarea`** 里，会话空闲数小时，你盯着工作区白等还怀疑自己看错。
- **根因**：`document.body.innerText.includes(关键词)` —— **输入框里的文本也算 innerText** ⇒ 恒为 true 的假验证。
- **正解**：**派工成功三标准**（缺一即重发）：① `document.querySelector('textarea').value.length === 0`；② `document.title` 变为任务主题（不再是 "DeepSeek Harness"）；③ **对话流正文区**出现任务文本（排除 textarea）。操作上：type 后先 `pilot_eval` 确认 `value.length > 0` 再点发送；发送后等 1–2 s 检查三标准，不满足立即重发。
- **判别**：任何"验证"读到的对象**可能包含输入源本身** ⇒ 它就是假验证。
- **出处**：01 号 §10.6 ④（L535–544）。

### J8 开工前五必设（访问模式与审批策略是**两个独立开关**）

- **症状**：VM 模型干到一半"停住不动"，**没有报错**。
- **根因**：会话访问模式默认 Workspace Write ⇒ 遇到需要越界的操作**卡在审批**；而"访问模式"与"审批策略"是两个独立开关，只设一个不够。
- **正解**：开工前**五必设** = 预设（Router Standard）+ 模型 + 推理等级 + **会话访问模式（danger-full-access，你已授权）** + 审批策略。
- **判别**：模型"停住"且无报错 ⇒ 先查访问模式/审批策略，**别急着判成死循环**（死循环的特征是 Think 重复，见 J6）。
- **出处**：02 号 §5.1 第 1 条（L100）、_归档/审计-2026-09/记忆审计-2026-09-11.md（L383）。

### J9 别轻信 VM 侧的"工具故障"诊断；工具消失先查宿主 patch

- **症状**：VM 报 `nodeOnPath:false`；或 agent 用着用着 **bash 工具消失**。
- **根因**：VM 侧诊断只到表象 —— 真根因是 **web 宿主 `cordis.patch.yml` 禁用了 tool-bash / tool-pwsh** + 预设注册行被误删（三层嵌套）；bash 工具必须由 **preset 层完整注册**才存在。
- **正解**：**主机模型自己进 VM 查根因**（读 preset 配置、cordis 组合、宿主 patch），不要照 VM 的结论去修别处。
- **判别**：工具列表里少了工具 ⇒ 先看宿主 patch 的 disable 清单与 preset 注册行。
- **出处**：02 号 §5.1 第 3 条（L102）、_归档/审计-2026-09/记忆审计-2026-09-11.md（L383）、_归档/审计-2026-09/矛盾候选清单-20260919.md 第 1 行。

---

## 十一、K. 探针、守卫与工具用法

> **本章主题**：脚本"跑绿了"但**判错了对象**（探针/守卫），以及一批**真踩过的工具用法坑**。
> **来源**：01 号 §13 / §14 / §15、17 号 §7.4、_归档/审计-2026-09/记忆审计-2026-09-11.md、事故/25。
> **一句话**：本仓的 bug 有一半不是逻辑错，是**编码错**和**探针错**。

### K1 探针自指 ⇒ 守卫永久拒绝

- **症状**：`preflight` 每次都拒绝（**永久拒绝**），理由却是"发现了目标进程"，且 pid 每次都不同。
- **根因**：`nodeProcesses()` 用 `-Filter "Name='node.exe' or Name='powershell.exe'"` + `CommandLine -like "*关键词*"` —— **查询串里含着自己要找的关键词**，而白名单又含宿主 shell ⇒ **每次都匹配到自己的命令行**。
- **正解**：**探针的输出里不许出现自己的命令行** —— 关键词**绝不拼进命令行**；走**环境变量**（WMI 的 `CommandLine` 看不到环境变量，结构上不可能自匹配）、`-File` 参数，或"捞全量 + 在调用方过滤"。
- **判别**：零成本**阴性对照** —— 用一个必然不存在的随机 token 调探针（`probe-guard-<random hex>`），返回命中即证明它在把自己当目标。
- **出处**：01 号 §15.2（L747–775）。

### K2 探测失败被当成"确认为否" ⇒ 永久放行 / 永久拒绝

- **症状**：① `stop` 打印 **"verified: 3080 is free"** 却**根本没验证** ⇒ `start` 可能起第二个实例；② 普通目录探测失败被当成"不存在" ⇒ 后续**永久拒绝**。
- **根因**：① `ListeningPid()` 的 `catch → return 0`（把"无法确认"当成"确认空闲"）；② `status !== 0 → return null` 用在普通探测上。
- **正解**：**`null`（无法确认）与 `false`（确认为否）必须分开**；"确认为空闲"与"无法确认"也要分开（`0` vs `-1`）。反例写法 `probe !== null && probe === target → refuse` 会在探测失败时**静默放行**（本仓真 kill 过 DSH）。
- **判别**：守卫里出现 `catch → return <默认值>` ⇒ 立刻怀疑它是 fail-open 还是 fail-closed。
- **出处**：01 号 §15.2（L752、L759–762）。

### K3 守卫必须**双向断言**；"保命组件"必须真跑一次

- **症状**：守卫自测全绿，线上仍被绕过（实测：守卫被 `null` 静默绕过，**误杀 DSH 本体**）；或"自更新机制 100% 失效"存活 0.1 s 却没人发现。
- **根因**：只测了"该拒时拒"，**没测"该放行时放行"** ⇒ "永远返回空"的假修复能骗过单向测试；以及 `ok:true` 只说明 spawn 没抛异常，**不说明命令真的执行了**。
- **正解**：① 每个守卫都要**双向断言**（该拒 + 该放行）；② "保命组件"（自动重启、看门狗、修复脚本）**必须定期用真实动作验证一次**。
- **判别**：写完守卫问自己一句"我有没有一个用例证明它**该放行时放行**"；答不出就是单向测试。
- **出处**：01 号 §15.2（L763–764）、§13 元教训（L677）、§14 表（L690–696）。

### K4 判据过窄 ⇒ 恒判"无监听"

- **症状**：端口明明在监听，脚本恒判没有（于是反复重启/起重复实例）。
- **根因**：`port3080Listening()` **只认字面量** `127.0.0.1:3080` ⇒ DSH 若改绑 `0.0.0.0` / IPv6 就**恒判无监听**。
- **正解**：判据覆盖合法形态（通配绑定、IPv6）；**放宽匹配类改动必须连同"该端口上还有哪些合法监听者"一起评估**（评审建议 → 实现回归的实例，见 K5）。
- **判别**：`netstat` 有而脚本说没有 ⇒ 查判据里的字面量。
- **出处**：01 号 §15.2（L753）、17 号 §7.4 教训（L192–204）。

### K5 `dsh.cmd stop` 不杀 ts-proxy ⇒ 端口匹配放宽后误判"服务仍在运行"

- **症状**：你 `dsh.cmd stop` 之后跑 phase2，脚本仍报 `[FAIL] dsh is still running on :3080`。
- **根因**：`dsh.cmd stop` 只按 `127.0.0.1:3080` 杀进程，**不杀 `ts-proxy.cjs`**（Tailscale 代理，由旧 `:launch` 以 `start "DSH-TS-Proxy"` 启动，监听 `100.82.106.4:3080`）⇒ 代理残留；而脚本按评审建议把匹配从精确 `127.0.0.1:3080` **放宽为 `:3080`** ⇒ 恰好匹配到残留代理。
- **正解**：放宽匹配前先枚举该端口上的合法监听者；停止时把代理一起纳入处置（或按监听地址精确匹配）。
- **判别**：stop 后端口"还在" ⇒ 先 `netstat` 看监听地址是不是代理那个 IP。
- **出处**：17 号 §7.4（L190–204）、§5.1（L109）。

### K6 文件工具传 `<工作区>/...` 会被误解析

- **症状**：`read` / `write` / `edit` 用 `<工作区>/...` 报文件不存在（或建到别的路径）；同一路径在 bash 里却好好的。
- **根因**：**文件工具不走 MSYS 路径转换** —— bash/pwsh 里 `<工作区>` 正确，文件工具会把它当成 `F:\f\dss` 这类错路径。
- **正解**：**文件工具一律传 `<工作区>/...`**；bash/pwsh 里用 `<工作区>` 没问题；node 原生进程用 `<工作区>`。
- **判别**：`ls <工作区>` 有、`read` 说没有 ⇒ 就是路径形式不匹配。
- **出处**：_归档/审计-2026-09/记忆审计-2026-09-11.md（L425）、事故/25-会话交接-新会话开篇必读.md（L111）。

### K7 编码用错 = **永久损毁**（三种损伤形态，只 grep `???` 会漏）

- **症状**：改完的 `.cmd` 中文变连续问号（`60-???`）、U+FFFD 替换字符（`2026-09-10-挹(`）、或**丢字节的乱码**（`::\dss\G?20260907` —— `F:` 整段消失、`FAIL` → `AIL`、`readFileSync` → `read:ileSync`），文件完全不可用。
- **根因**：① `fs.writeFileSync(p, 含中文的字符串, "latin1")` ⇒ **每个中文被截成单字节**；② 用 UTF-8 读 GBK 文件（已归档的 `repath-ascii.mjs` 就这么毁掉 **13+ 个 `.cmd`**）。**都是不可逆的**。
- **正解**：改编码敏感文件**先按类型选编码**：`.cmd/.bat` 新写的一律纯 ASCII（历史 GBK 的走 `chcp 936`）；`.cs` 必须纯 ASCII（**含注释**）；`.ps1` UTF-8 **带 BOM** 或改走 node；`.mjs/.json/.md` UTF-8 **无 BOM**。GBK 读写走 pwsh `Encoding(936)`，改完**断言全文无非 ASCII 字符**。
- **判别**：三种损伤形态都要查（连续问号 / U+FFFD / 丢字节乱码），只搜 `???` 会漏。
- **与 C1/C2 的分工**：C1/C2 讲"**怎么做**"（`TextDecoder('gbk')` 读、pwsh 写），本条讲"**做错了会怎样、怎么查出来**"。
- **出处**：01 号 §15.1（L709–738）、§6 编码提示（L297）。

### K8 JSON 禁带 BOM；`.ps1` 无 BOM 会被按 GBK 读

- **症状**：`JSON.parse` 莫名失败；`.ps1` 的中文注释导致语法错乱（**本机仅 PowerShell 5.1**）。
- **根因**：JSON 带 BOM ⇒ parse 失败；PS 5.1 把**无 BOM 的 UTF-8 当 GBK 读**。
- **正解**：写 JSON 后**查前 3 字节 = `7b 22`**；`.ps1` 加 BOM 或改走 node。
- **判别**：`JSON.parse` 报 `Unexpected token` 但肉眼看不出开头有字符 ⇒ 查前 3 字节。
- **出处**：_归档/审计-2026-09/记忆审计-2026-09-11.md（L44、L425）、事故/25（L111）、01 号 §15.1（L716）。

### K9 改文件按【行号】，不靠【模式匹配】

- **症状**：脚本每个替换都打了 ✓，**结果只修了一半**（"报已修完、实际没修完"）。
- **根因**：同一条路径在一行里可能是 `set BAK=...`（行尾）也可能是 `...\subdir`（带尾反斜杠），**一个模式只能命中一种形态**。
- **正解**：按**行号**改；**改完立刻跑一次真测试**（drill/断言），**不要拿"替换成功"当验收**。
- **判别**：替换计数小于预期、或复核时发现残留 ⇒ 换行号定位重做。
- **出处**：01 号 §15.1 第 3 条（L739–741）、§15.3 末行（L787）。

### K10 `Get-ChildItem -Include` 静默返回空 = 假绿

- **症状**：脚本报"无异常 ✓"，实际上**一个文件都没扫到**（**不报错**）。
- **根因**：`-Include` 没配 `-Recurse` 时静默返回空。
- **正解**：`-Include` **必须配 `-Recurse`**，或改用 `-Filter`。
- **判别**：扫描结果为空但目录里明明有文件 ⇒ 先查参数组合。
- **出处**：01 号 §15.3（L781）。

### K11 cmd / PowerShell 的四个参数与内置命令坑

- **症状**：① `set /p X=<file` 读到的**是文件名**而不是内容；② `timeout /t` 报 `invalid time interval "/t"`；③ `for /f` 里把 `^|` 转义给 PowerShell ⇒ 报 `Get-CimInstance: 找不到接受实际参数 "^"`；④ `wmic process where "processid=N"` 部分版本解析失败 ⇒ 白名单**误拒绝**。
- **根因**：① 文件**没有换行符**时 `set /p` 的行为；② **Git-Bash 的 `timeout` 影子抢先**；③ 在 `for /f` 里转义管道给 PowerShell 行不通；④ wmic 在新版 Windows 上退化。
- **正解**：① 用 pwsh `Get-Content -Raw`（或写 PID 文件时补一个换行）；② 用 `%SystemRoot%\System32\timeout.exe` 绝对路径或 `powershell Start-Sleep`；③ 把整段逻辑**交给一次 PowerShell 调用**；④ 改 `Get-CimInstance Win32_Process -Filter "ProcessId=N"`。
- **判别**：报错里出现"影子"命令或参数被吞 ⇒ 换绝对路径/换 cmdlet。
- **出处**：01 号 §15.3（L782–786）。

### K12 `dsh.cmd stop` 之后辅助件又起来了（`--ensure` 在前）

- **症状**：停完 dsh，发现生命周期记录器 / 看门狗**又跑起来了**。
- **根因**：`dsh.cmd` 在**任何命令分派之前**执行 `dsh-lifecycle-watch.mjs --ensure` 与 `host-watchdog.mjs --ensure`（幂等 + 单实例锁）⇒ 对**每条**命令都生效，"stop"也不例外。
- **正解**：**先 stop，再停辅助件**（或按设计接受"辅助件随 dsh 启动带起"）。
- **判别**：stop 后 `--status` 里辅助件仍在 ⇒ 就是这个机制。
- **出处**：01 号 §15.3（L783）、§12（L650）。

### K13 `spawn('cmd', ['/c', script, ...args])` 里每个 token 都拼路径 ⇒ 命令静默失效

- **症状**：被调脚本收到一个**长成路径的参数**（如 `<工作区>\scripts\restart`）⇒ 打印 usage 行并 `exit 1`；而调用方看到的是"spawn 成功、`ok:true`"，**实际什么都没做**（看门狗的自动重启、健康监控的 `run.*` 全部静默失效）。
- **根因**：调用方把**每个** token 都拼成脚本路径；且 `ok:true` 只说明**没抛异常**，不说明命令执行了。
- **正解**：**只把第一个 token 拼成脚本路径**，其余**原样透传**；需要多参数时把白名单值改成**数组**，不要空格拼接（`cmd.exe` 会二次解析 `& | ^ > " %VAR%`，有注入语义）。
- **判别**：脚本打 usage、调用方报成功 ⇒ 打印实际 argv 核对；**"保命组件"必须用真实动作验证一次**。
- **出处**：01 号 §13（L669–677）。

### K14 `.bat/.cmd` 被存成 LF ⇒ cmd 把**行碎片当命令**执行

- **症状**：双击 `DSH-Launcher.exe` / `启动DSH-Web.bat` 失灵，黑框里报 `'uncher' 不是内部或外部命令`、`'th' …`、`'restart' …`（乱码碎片命令），DSH 起不来。
- **根因**：批处理被存成 **LF-only**；`cmd.exe` 解析纯 LF 批处理有缺陷 —— **行尾字符与下一行首字符粘连**，`rem DSH unified launcher…` 被拆出 `'uncher'` 当命令执行。Linux 无此问题（bash 以 LF 为标准）。
- **正解**：Windows `.bat/.cmd` **必须 CRLF**；工具（write）写文件**默认 LF**，写完**必须校验换行符**（`LF=0` 才算 OK）。历史处置：扫描 `<工作区>` 发现 **22 个 LF-only**，批量转 CRLF 后启动器恢复。
- **判别**：看到**碎片命令**报错第一时间查换行符；同一脚本分别存 LF 版/CRLF 版 `cmd /c … status` 对比即可锁定。
- **与 B4/A2 的分工**：A2 讲 `.cmd` 的**编码**、B4 讲 `iconv|sed` **吞 `\r`**；本条讲 LF 化本身的**症状形态与诊断入口**。
- **出处**：01 号 §4.7（L233–246）、§6 清单（L314）。

### K15 `schtasks` / Task Scheduler 在本机沙箱不可用

- **症状**：脚本用 `schtasks` 注册计划任务报**进程级终止 / 拒绝访问**。
- **根因**：本机沙箱（受限执行环境）下 Task Scheduler 不可用。
- **正解**：改用**常驻定时器**（node 脚本 + 启动文件夹 `.cmd` + `Start-Process` 独立进程）或 Linux 侧 cron；我们 `mnemon-sync-timer.mjs` 就是这么做的。
- **判别**：`schtasks` 报拒绝访问 ⇒ **换方案，别反复试**。
- **出处**：_归档/审计-2026-09/记忆审计-2026-09-11.md（L237、L243、L273）。

### K16 `rsync --update` 首次同步"没生效"（较新的目标被保留）

- **症状**：首次双向同步后，目标侧内容**没更新**（`rsync` 却报成功）。
- **根因**：`rsync -a --update` **遇目标较新会保留目标**（跳过）；目标文件 mtime 比源新（刚解包/刚 touch）时就这样。
- **正解**：**首次同步先 `touch` 把目标 mtime 归零**再跑；主机侧用 robocopy `/E /XO`（较新者胜）配对。
- **判别**：rsync 报成功但文件没变 ⇒ 先比对两侧 mtime，**别怀疑网络/挂载**。
- **出处**：_归档/审计-2026-09/记忆审计-2026-09-11.md（L237、L243、L273）。

---

### K17 `pwsh` 这个名字会骗人：工具走 5.1，但**经 bash 可直接用 PowerShell 7**

- **症状**：以为在写 PowerShell 7 语法，结果 `&&`、`||`、`??`、`-Parallel` 之类要么报错、要么行为不对。
- **根因（2026-09-21 实测）**：harness 的 `pwsh` **工具名**叫 pwsh，但**实际执行的是** `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`（`PSEdition=Desktop`、`PSVersion=5.1.26100.9444`）。主机上**确实也装了 PowerShell 7.6.6**（`AppData\Local\Microsoft\WindowsApps\pwsh`，Store 执行别名），但**工具不走它**。
- **正解（2026-09-21 实测更新，取代同日早前口径）**：① **想要 7 的特性，就在 bash 里直接调 `pwsh`** —— `pwsh -NoProfile -NonInteractive -Command '…'` 实测走 **7.6.6 / Core**（`??`、`&&`、`ConvertTo-Json -Depth`、中文与 emoji 输出全部正常）⇒ **首选这条路**，别因为"工具走 5.1"就以为用不上 7；② 只有必须用 harness 的 `pwsh` **工具**时，才按 **5.1** 约束写（`;` / `if` / `foreach` 代替 `&&`/`||`；不用 `??`、三元 `?:`、`-Parallel`）；③ 更省心的文本/数据处理改走 **node**；④ **你自己的终端**用的是同一个 7.6.6 二进制。
- **判别**：在工具里跑 `$PSVersionTable.PSEdition` —— `Desktop` ⇒ 5.1；`Core` ⇒ 7。
- **出处**：2026-09-21（装完 PS7 后实测：工具自报 5.1 + 进程路径为 powershell.exe）。
### K18 Python / uv 的正确用法（2026-09-21 实测）

- **定位**：本机 Python **3.14.5**（`AppData\Local\Programs\Python\Python314`）+ **uv 0.11.16** —— 数据 / 文本 / 爬取 / 一次性分析的**首选**（库生态比 node 强），且 **uv 免环境管理**。
- **正确用法**：`uv run --with requests --index-url https://pypi.tuna.tsinghua.edu.cn/simple python x.py` —— 实测 **98ms 装好 5 个包**并跑通（requests 2.34.2），**不污染系统环境**。
- ⚠️ **坑 1（中文乱码）**：在 bash 里跑 Python，中文输出会变乱码（Windows 下 stdout 默认 cp936）⇒ 加环境变量 `PYTHONIOENCODING=utf-8`，或在脚本内 `sys.stdout.reconfigure(encoding="utf-8")`。
- ⚠️ **坑 2（解释器不是系统的）**：`uv run` 默认用 **uv 自己管理的解释器**（实测跑在 Python **3.12.13**，而非系统 3.14.5）⇒ 需要系统版本时加 `--python 3.14`，或直接用 `python`。
- **网络**：pypi 走**清华镜像**可用（`--index-url https://pypi.tuna.tsinghua.edu.cn/simple`）。
- **dotnet 现状（顺带测）**：本机**只有 runtime、没有 SDK**（`dotnet --version` 报 "command could not be loaded"；runtime 有 .NET 6/9/10）⇒ **只能跑不能编译**，agent 用不上；不建议为此装 SDK。
- **出处**：2026-09-21 实测（Python 标准库 json/re/urllib/csv/sqlite3 均 OK；uv 98ms 装包；dotnet 无 SDK）。
## 十二、L. 生图与本地模型

> **本章主题**：本地 ComfyUI 出图、seedream 云端出图、以及本地小模型（digest / ollama）的踩坑。
> **来源**：10 号 §3 / §5 / §6、07 号 §3、同仓另篇 §六。

### L1 GGUF 量化路径输出模糊（弃用）

- **症状**：本地出图整体发糊（实测 face sharpness **4**，而 fp16 是 **16**）。
- **根因**：走了 `ComfyUI-GGUF` + `fast-illustrious-q4` 量化路径，画质显著劣化。
- **正解**：**直接用 fp16 safetensors**（正解，GGUF 弃用）；另注意 GGUF 的 `unet_name` 要读 `models\diffusion_models\`（不是 `checkpoints\`，也不是自建 `unet_gguf`）。
- **判别**：出图糊**先问 ckpt 是 GGUF 还是 fp16** —— 别一头去调 steps/cfg 白费功夫。
- **出处**：10 号 §6 踩坑 1 / 2（L82–83）。

### L2 IPAdapter：文件名按预设**正则**匹配 + 高权重劣化清晰度

- **症状**：① `IPAdapterUnifiedLoader` 找不到模型 / clip_vision；② 一上参考图，出图清晰度暴跌（sharpness 13.8 → 1.9）。
- **根因**：① IPAdapter 文件名是**按预设正则匹配**的（`clip_vision` 必须命名成 `ViT-H-14-laion2B-s32B-b79K.safetensors` 这类匹配名）；② 权重 `weight 0.85` 过高。
- **正解**：文件名按预设规范命名；权重用 **0.4 + `style transfer`**（实测 sharpness 9.9，可用）；参考图放进 `ComfyUI\input\`（LoadImage 按名读取）。
- **判别**：报"找不到模型"先查**文件名**而不是路径；出图糊先看 **weight**。
- **出处**：10 号 §5（L75–77）、§6 踩坑 3（L84）。

### L3 漏性别标签 ⇒ 男性角色立绘全变女性

- **症状**：男性角色立绘全部女性化（"凌虚子变女掌门"）。
- **根因**：Illustrious（danbooru 系）**默认偏女性**；prompt 没带性别标签。
- **正解**：prompt **必须**带 `1boy/1girl, solo, adult male/female, masculine/feminine`，男性再加 `beard`/短须 等特征词强化；**覆盖前保留原图**（ComfyUI `output\` 有历史备份 `dsh_sdxl_*.png`，**勿急着删 test 图**）。
- **判别**：出图性别不对 ⇒ 先查标签，别急着换模型。
- **出处**：10 号 §3（L54）、§6 踩坑 0（L81）。

### L4 hf-mirror 大文件下载截断 / gated 仓库下不动

- **症状**：>1GB 的模型文件"下载完成"了，加载却报损坏。
- **根因**：hf-mirror 大文件下载会**截断**；`stabilityai/sdxl` 这类仓库是 **gated**（无权限）。
- **正解**：>1GB 文件用 curl **分段 range 下载**；gated 仓库改走非 gated 的镜像仓（`stabilityai/stable-diffusion-xl-base-1.0`）。
- **判别**：加载报损坏 / 尺寸不符 ⇒ **先核对文件字节数**，别怀疑 ComfyUI。
- **出处**：10 号 §6 踩坑 4（L85）。

### L5 seedream 图片链接只活 24 小时

- **症状**：交付物里的图片链接隔天 404。
- **根因**：默认 `response_format=url`，**链接 24 小时过期**。
- **正解**：拿到响应**立刻下载转存**（我们 `gen_seedream.py` 直接落盘），或改用 `b64_json`。
- **判别**：链接当场能开、隔天失效 ⇒ 就是这个原因。
- **出处**：07 号 §3 避坑 1（L62）。

### L6 seedream 水印默认**开**

- **症状**：生产素材右下角带"AI生成"字样。
- **根因**：`watermark` 默认 `true`。
- **正解**：生产素材**显式传 `watermark=false`**。
- **判别**：见到右下角水印先查有没有传这个参数。
- **出处**：07 号 §3 避坑 2（L63）。

### L7 seedream 提示词超长是"**丢元素**"，不是"慢慢变糊"

- **症状**：长 prompt 出图**缺细节、缺元素**，而且**每次缺的不一样** ⇒ 极难排查。
- **根因**：提示词超长会被模型"忽略细节、缺失元素"（建议 **≤300 汉字 / 600 英文词**）；**从别家迁来的长提示词**最容易中招。
- **正解**：先压缩提示词长度；A/B 测方向用 `optimize_prompt_options.mode = fast` 批量出草稿，选定后 `standard` 出终稿。
- **判别**：症状是"**元素消失**"而不是"清晰度下降" ⇒ 先砍 prompt 长度。
- **出处**：07 号 §3 避坑 3 / 4（L64–65）。

### L8 seedream 参考图硬限制 + 交互编辑的标记要**自己画**

- **症状**：① 参考图上传报错（HEIC / 超大 / Base64 格式名大写）；② 出图把标记（框、箭头、涂鸦）当成画面元素渲染进去。
- **根因**：① 单张 ≤30MB、总像素 ≤6000×6000、宽高比 1/16~16、**Base64 格式名必须小写**（`data:image/jpeg;base64,...`）；② 请求参数里**没有** region/mask 字段 —— 标记是**画在参考图上传**的。
- **正解**：手机原图 / HEIC 先压缩转码；交互编辑的 prompt **必须补两句**："**移除所有草图线条**"（否则标记被当画面元素渲染）+"**保持构图不变**"。
- **判别**：出图里出现箭头/线框 ⇒ 漏了那两句。
- **出处**：07 号 §3 避坑 5 / 6（L66–67）。

### L9 `digest` 的"静默假失败"（本地模型输出未转义双引号）

- **症状**：`digest` 报告写着「置信度 0 / **覆盖：无直接证据**」，但信息**其实就在原文里**；退出码仍为 2 ⇒ 极易被读成"这里没这条规矩"。
- **根因**：本地模型偶尔在 JSON 里输出**未转义的英文双引号** ⇒ 解析降级 ⇒ 报告降级（实测 **2 次中 1 次**）；降级报告还会附最多 2000 字符原始输出，**比正常报告更占上下文**。
- **正解**：**看"回答"栏是否写着「(解析失败，见原始输出)」** —— 只要看到这句，就把结论当成"**我根本没查到**"（不是"手册里没写"），重跑一次或改用 `grep`；要留可复现证据用 `digest -o <文件>`。
- **判别**：`exit 2` + "无直接证据" ⇒ **必须回原文核对**（报告是导航，不是结论）。
- **出处**：同仓另篇 §六 铁律 4（L94）、§六 实测失效案例（L99）。

### L10 `digest` 的两个接口坑：`--api-url` 报 404 与"**没有 `--help`**"

- **症状**：① `--api-url http://10.0.2.2:11434` 报 `HTTP 404: 404 page not found`；② `node digest.mjs --help` 只打印用法并 `exit 1`。
- **根因**：① 该分支走 OpenAI 兼容、**硬拼 `/chat/completions`**，而 ollama 根路径没有这个端点；② 源码**没有 `--help` 处理**。
- **正解**：① 加 `/v1`，或直接用 `--ollama <url>`（走 `/api/chat`；VM 侧用 `http://10.0.2.2:11434`）；② 参数表看 11 号 §三，**别用 `--help` 探测**。
- **判别**：404 + ollama 端口 ⇒ 路径缺 `/v1`。
- **出处**：同仓另篇 §六（L87–88、L97–99）。

---

## 十三、F. 待补充 / 待验证（还没踩实，先记着）

| # | 待验证项 | 触发场景 |
|---|---|---|
| F1 | `MAX_PATH` 与 junction 的组合行为（这个工作区有多个 junction，其中一个是链式） | 路径超长报错时 |
| F2 | pwsh 沙箱模式下 `.NET` 静态方法可用性差异（read-only 会退化为 ConstrainedLanguage） | 在受限模式跑 `[IO.File]::` 时 |
| F3 | 交互式 `.cmd` 的"非交互冒烟"标准写法（给 `run-upgrade.cmd` 加 `--smoke` 的可行性） | 要自动测菜单时 |
| F4 | `delivery_check` 的 64KB 校验在**汉字边界**会误报编码错（实测：第 64KB 最后一个字节是 UTF-8 续字节 `0x8a` ⇒ 切片切断汉字 ⇒ 报 "not valid utf-8"，而全文严格解码 OK）。**2026-09-21 复现确认**：本手册自身 77,832 字节时切点是汉字**首字节** `0xe5`（`b[:65536]` 解码报 `unexpected end of data`），而 Python 严格解码全文 OK（44,769 字符）、无 BOM ⇒ **判定为工具侧切片误报，不是文件编码问题** | 文件 >64KB 且 gate 报编码失败时（**先跑严格解码反证，别改文件去凑字节边界**） |
| F5 | junction 删除**只能** `rmdir` / `.NET Directory.Delete`（**`del /s` 会删进真身**）；2026-09-21 删 `dsh-token-usage-cost-src` 实战：删后对拍真身 10 文件完好 | 清理目录联接时 |
| F6 | **UI/皮肤类插件与 `filter`/`some` 渲染崩溃的因果关系未证实**：13 号曾把 `better-sidebar` 标"疑与崩有关"，15 号定案真因是 mnemon peer 范围不含宿主 ⇒ "UI 类插件引起崩溃"目前仍是**推测**，别据此禁用 | 判断 UI 类插件该不该禁时 |
| F7 | **`--patch` 模型覆盖在 GUI 会话下的行为未系统实测**：已定案的是 headless 被 settings 压过（J3）；01 §10.10 的"GUI 会话同受影响"是推断性表述，GUI 侧实测走的另一条路径（顶部模型选择器） | 想给已有 GUI 会话换模型时 |
| F8 | **rsync `--update` 与 robocopy `/XO` 混用时的"较新者胜"边界未验证**：首次同步须 `touch` 归零 mtime 已实测（K16），但跨时区/夏令时 mtime 差异、目录级与文件级判定的优先级都还没踩过 | 双向同步出现"较新"冲突时 |

---

## 十四、维护规则（什么时候更新这本手册）

1. **新踩到坑**：先追加到原料区 `60-ops\素材\工具与代码坑.md`（现象 → 根因 → 正解 → 出处），**再**整理进本手册对应主题 + 速查表补一行。
2. **不写没踩过的理论**：本书只收"我们实际踩过并已修正"的条目；猜测性的写法放 §八 待验证。
3. **每条必须有"出处"**：日期 + 具体文件/命令/回函号，便于回溯。
4. **速查表是入口**：新增条目**必须**同时补速查表一行（否则等于没写）。
5. **原料区 vs 手册的分工**：原料区 = 随手记（可粗糙）；手册 = 整理后的可查形态（要能直接照着做）。
6. **扩编（2026-09-21）**：本手册已不止素材区一个来源——02 / 05 / 07 / 08 / 10 / 12 / 15 / 17 / 同仓另篇手册与 `事故\`、`审计\` 目录里的同类实操坑**逐条核对现有条目后**并入 H–L 章（出处随条目给出）。**同主题新坑优先在既有章续编**（如新的编码坑 → K 章），不另起风格。

---
