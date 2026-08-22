# ProductThink

一个帮助创业者和产品经理验证产品想法的 AI 产品顾问。项目是单一 Next.js 全栈应用：页面、API、Agent 编排、知识库检索与内容工具均使用 TypeScript。

## 能力

- 苏格拉底式产品顾问对话，支持流式输出和持久化会话
- OpenAI Agents SDK 驱动的产品顾问、总结、用户画像、专家分析与六角色评审
- OpenAI Vector Store 托管精华知识库；支持产品、战略、增长与案例检索
- Gemini、Cloudsway、VectorEngine、OpenRouter 与 OpenAI 的顺序降级；也支持用户临时配置 OpenAI 兼容模型
- Supabase 对话记录、CMS、认证、反馈及埋点

## 项目结构

```text
product-judge/
├── frontend/                    # 唯一的 Next.js 全栈应用
│   ├── src/app/api/             # Route Handlers
│   ├── src/server/agents/       # Agents SDK、模型路由、检索与会话
│   ├── knowledge/               # 内置精华知识
│   ├── data/                    # 内容运营配置
│   └── scripts/                 # 知识库、OCR、Sparks 的 TypeScript 工具
└── 产品知识库/                   # 产品知识源文件
```

## 开发

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

应用地址为 `http://localhost:3000`。不再需要启动 Python/FastAPI 服务。

## 环境变量

`OPENAI_API_KEY` 和 `OPENAI_VECTOR_STORE_ID` 用于托管知识库；其他模型服务商仅作为聊天/分析模型的可选降级链路。

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4
OPENAI_VECTOR_STORE_ID=
AGENTS_TRACE_ENABLED=false

GEMINI_API_KEY=
GEMINI_API_BASE=
GEMINI_CHAT_MODEL=
CLOUDSWAY_API_KEY=
CLOUDSWAY_BASE_URL=
CLOUDSWAY_MODEL=
VECTORENGINE_API_KEY=
OPENROUTER_API_KEY=
```

默认尝试顺序为：Gemini → Cloudsway → VectorEngine → OpenRouter → OpenAI。模型选择器提供的自定义配置仅用于该次请求，不会保存到服务端日志或数据库。

## 知识库与内容工具

首次设置 OpenAI Vector Store：

```bash
cd frontend
npm run knowledge:sync
npm run knowledge:verify
```

`knowledge:sync` 会导入 `frontend/knowledge` 和产品知识库五个精华目录，不会导入原始资料归档。

```bash
npm run sparks:scan
npm run sparks:generate
npm run kb:process
npm run kb:watch
```

OCR 命令需要本机已安装 `poppler` 和 `tesseract`（含 `chi_sim` 与 `eng` 语言包）。

## 验证

```bash
cd frontend
npm test
npx tsc --noEmit
npm run build
```

生产默认关闭 Agents tracing；仅在开发或预发环境设置 `AGENTS_TRACE_ENABLED=true` 后开启。
