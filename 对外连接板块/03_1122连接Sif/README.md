# 1122 连接 Sif

## 定位
负责网页版智能体 1122 与 Sif 关键词/流量/竞品/广告研究能力之间的正式连接。

## 官方接入方式
优先使用 Sif MCP（Model Context Protocol，模型上下文协议），不使用网页抓取、Cookie 复用或浏览器自动化作为正式数据通道。

- MCP Endpoint（接口地址）：`https://mcp.sif.com/mcp`
- MCP 密钥管理：`https://www.sif.com/mcp?tab=secret`
- 认证：`secret-key` Header（请求头）；Sif 官方同时兼容 URL `?secret-key=` 方式，但 1122 不把密钥放进 URL。
- Secret（加密密钥）名称：`SIF_MCP_SECRET`
- 默认站点：`US`

## 1122 架构

```text
1122 Web
  ↓
1122-sif-bridge（Cloudflare Worker）
  ↓
Worker Secret: SIF_MCP_SECRET
  ↓
https://mcp.sif.com/mcp
  ↓
Sif MCP Tools
  ↓
选品 / 运营 / A3竞品 / A4广告 / A5流量 / A1决策
```

## 第一阶段
1. 部署 `1122-sif-bridge`；
2. Worker Secret 保存 `SIF_MCP_SECRET`；
3. 通过 MCP initialize（初始化）验证真实连接；
4. 查询 tools/list（工具列表）并只向前端返回工具数量、协议版本等非敏感状态；
5. 1122 对外连接中心显示 Sif 连接状态。

## 第二阶段能力
计划按业务域封装 Sif MCP Tool：

- 反查流量词 / ASIN 关键词信号；
- Listing 关键词分布；
- 关键词需求与历史趋势；
- 关键词竞争格局；
- ASIN 流量结构与趋势；
- 竞品运营/流量诊断；
- ASIN 广告结构、广告流量趋势、广告活动变化；
- 异常诊断与机会发现。

## 安全边界
- `SIF_MCP_SECRET` 不提交 GitHub、不写入 1122 前端、不写 localStorage；
- 不在 URL 中传 MCP 密钥，避免日志/历史记录泄露；
- 公开 1122 页面第一阶段只读取粗粒度连接状态，不开放任意 MCP Tool 代理；
- 后续真实数据查询通过预定义业务接口暴露，禁止任意 JSON-RPC 转发；
- 调用额度、失败重试和审计进入任务/事件层统一管理。
