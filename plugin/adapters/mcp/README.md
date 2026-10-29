# MCP 适配：给支持 MCP 的客户端用

零依赖，只用 node 内置模块，手写 JSON-RPC 2.0。

暴露两个工具：`search_pairing_notes`（检索手册）与 `pairing_workflow`（取工作流）。

## 配置（stdio）

在客户端的 MCP 配置里加一条，命令是 `node`，参数是本目录 `server.mjs` 的绝对路径。

```json
{
  "mcpServers": {
    "pairing-notes": {
      "command": "node",
      "args": ["<仓库路径>/plugin/adapters/mcp/server.mjs"]
    }
  }
}
```

各客户端配置文件位置不同：Claude Desktop 是 `claude_desktop_config.json`，Cursor 是 `.cursor/mcp.json`，Cline 和 Continue 在各自设置里。把上面那段贴进去，把 `<仓库路径>` 换成实际路径。

需要 Node 22 以上。

## 自检（不用客户端也能验）

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_pairing_notes","arguments":{"query":"cmd 中文乱码","limit":2}}}' \
| node server.mjs
```

期望：第 1 条回 `serverInfo`，第 2 条回两个 tool，第 3 条回命中的笔记条目。

## 协议实现范围

| 方法 | 状态 |
|---|---|
| `initialize`、`notifications/initialized`、`ping` | 已实现 |
| `tools/list`、`tools/call` | 已实现 |
| `resources/list` | 返回空数组（笔记没做成资源） |
| `prompts/*` | 未实现 |
| 传输 | 仅 stdio，没做 SSE 与 HTTP |

只做这两个工具是有意的：这一层就是给检索手册和取工作流用的。
