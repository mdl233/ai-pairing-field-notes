# MCP 适配 —— 给支持 MCP 的客户端用

**零依赖**（只用 node 内置模块，手写 JSON-RPC 2.0），不装任何包。

暴露两个工具：**`search_pairing_notes`**（检索手册）· **`pairing_workflow`**（取工作流）。

---

## 配置（stdio）

在你客户端的 MCP 配置里加一条，命令是 **`node`**，参数是 **本目录 `server.mjs` 的绝对路径**：

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

各客户端的配置文件位置不同（例：Claude Desktop 是 `claude_desktop_config.json`，Cursor 是 `.cursor/mcp.json`，Cline/Continue 在各自设置里）——
**把上面那段 JSON 贴进去，然后把 `<仓库路径>` 换成你 clone 的实际路径即可。**

> 需要 Node 22+（`core/` 用了 `import.meta.dirname` 等现代特性）。

---

## 自检（不用客户端也能验）

```bash
# 发三条 JSON-RPC 给 server，看它回什么
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_pairing_notes","arguments":{"query":"cmd 中文乱码","limit":2}}}' \
| node server.mjs
```

期望：第 1 条回 `serverInfo`、第 2 条回两个 tool、第 3 条回命中的笔记条目。

---

## 协议实现范围（如实）

| 方法 | 状态 |
|---|---|
| `initialize` / `notifications/initialized` / `ping` | ✅ |
| `tools/list` / `tools/call` | ✅ |
| `resources/list` | ⚠️ 返回空数组（笔记没做成资源；需要的话可以加） |
| `prompts/*` | ❌ 未实现 |
| 传输方式 | 仅 **stdio**（没做 SSE / HTTP） |

**只做这两个工具是有意的**：这一层是给"检索手册 + 取工作流"用的，不做更多。
