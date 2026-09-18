# Cloudflare Connector

目标：让 GPT 通过 Connector 方式访问 Cloudflare 数据资源，使用方式类似 GitHub Connector。

## 第一阶段目标

仅实现只读访问能力：

- 查询 Cloudflare D1
- 读取 KV 状态
- 读取 R2 文件

## 架构

```
GPT
 |
Cloudflare Connector
 |
Cloudflare API / Worker Gateway
 |
D1 / KV / R2
```

## 后续扩展

- MCP Server
- Agent Tool Registry
- 权限控制
- 审计日志
