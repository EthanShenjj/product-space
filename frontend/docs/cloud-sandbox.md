# 云端工具沙箱

该执行面用于运行 CLI、MCP wrapper 与 Skill adapter。用户可在对话中提出安装请求，产品顾问先生成安装提案；只有用户点击“确认并创建”后，系统才在该用户独立的 VM 内安装包并创建快照。它不是远程 shell：客户端永远不能传入任意命令、环境变量或网络地址。

## 安全边界

- 默认关闭（`SANDBOX_ENABLED=false`）。对话创建要求用户已登录；平台全局工具管理接口 `/api/sandbox` 仅管理员可访问。
- 每次调用创建一台一次性 Vercel Sandbox Firecracker 微虚拟机，完成后立即停止；宿主文件、数据库连接串和应用环境变量不会传入。
- 工具运行时默认 `deny-all` 网络策略。确有需要时，在工具登记里精确列出域名；不可使用 `*`。
- 不接受来自浏览器的命令、命令参数、工作目录、环境变量、包名或网络地址。
- 输出限制为 20 KB，并会脱敏常见 API key、Bearer 与 GitHub token 格式；日志仅保存操作 ID、工具 ID、Sandbox ID、退出码和耗时。
- 单个 IP 最多每分钟执行 5 次；单次工具运行最多 50 秒。该限流是单实例防护，生产上应在网关增加持久化限流。

## 用户对话创建 CLI / MCP / Skill

用户不需要、也看不到 `SANDBOX_SNAPSHOT_ID` 与 `SANDBOX_TOOL_REGISTRY`。当用户在对话中明确提出“安装/添加”某个工具，并且包名、精确版本及固定命令都明确时，Agent 会显示确认卡。确认后 `/api/sandbox/provision` 会：

1. 将工具记入该用户的 `sandbox_tools`；
2. 在新建 VM 内从 npm registry 安装精确版本；
3. 为该用户创建不可变快照并保存状态；
4. 失败时标记失败，不会影响其他用户、主应用或已有快照。

在部署前应用 [`supabase-migrations/20260827_user_sandbox_tools.sql`](../supabase-migrations/20260827_user_sandbox_tools.sql)，并只由平台运维在 Vercel 设置 `SANDBOX_ENABLED=true`。用户本身无需配置 Vercel 环境变量。

## 平台预置 CLI / MCP / Skill（可选）

1. 从 [`sandbox/tool-registry.example.json`](../sandbox/tool-registry.example.json) 复制模板，审查后压缩为一行 JSON，保存为 Vercel 的 `SANDBOX_TOOL_REGISTRY` 环境变量。
2. 每个条目都必须有固定的 `command` 与 `args`。需要输入的工具必须从命令最后一个参数 `/tmp/productthink-input.json` 读取 JSON；绝不能将输入插入 shell 字符串。
3. `kind: "mcp"` 应指向一个预安装的 MCP wrapper。wrapper 自行使用 stdio/JSON-RPC 与特定 MCP server 通信；浏览器不能选择 MCP server 或覆盖其参数。
4. `kind: "skill"` 应指向 Skill 的固定 adapter，而不是原始 `SKILL.md` 或任意脚本。adapter 将 JSON 输入映射为有限的一组动作。
5. 精确锁定 `install` 里的 npm 版本；先审查包及其依赖，再执行 `npm run sandbox:snapshot`。安装发生在隔离 VM 内，而不是应用构建机。
6. 将脚本输出的 `SANDBOX_SNAPSHOT_ID` 配置到 Vercel，作为平台预置工具镜像。生产部署自动使用 Vercel OIDC；本地执行脚本需要已关联 Vercel 项目并具备 Sandbox 凭据。

## API

`GET /api/sandbox` 返回可展示的工具元数据。`POST /api/sandbox` 请求示例：

```json
{ "toolId": "example-cli", "input": { "query": "product strategy" } }
```

成功响应仅包含 `operationId`、退出码、耗时和已截断/脱敏后的 stdout、stderr。安全配置、安装包、网络范围和 Sandbox ID 不会返回客户端。

## 上线前检查

- 生产环境保持 `SANDBOX_ENABLED=false`，直到 tool registry、网络域名、npm 包版本和 MCP wrapper 都完成审查。
- 使用最小权限的外部 token；当前版本不会将任何宿主密钥注入到 Sandbox。
- 为每个新增工具建立快照并验证网络拒绝、超时、中止、输出脱敏和非管理员访问均符合预期。
