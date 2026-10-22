# 产品资讯

页面 `/news` 每天展示 X、Product Hunt、GitHub 各最多 5 个软件或 AI 产品。支持来源、类型和关键词筛选；排名保留来源中的原始名次，不跨平台比较热度。

## 数据口径

- **X**：官方 Recent Search API，取近 24 小时最多 100 条相关产品发布帖；必须包含站外产品链接和发布语义。按 `点赞 + 转发 × 2 + 引用 × 2 + 回复` 排序，以产品链接去重。产品名优先使用链接卡片标题，缺失时使用域名。它是搜索候选榜，不能代表全站全部讨论。
- **Product Hunt**：官方 GraphQL API，取近 24 小时发布、按票数排序的前 100 个候选，依据主题和简介筛选软件和 AI 产品，再取前 5。
- **GitHub**：官方 Repository Search API，分别查询 `ai`、`llm`、`saas`、`developer-tools`、`productivity`、`automation` 六个主题。每个主题最多 100 个候选，要求近 24 小时更新、有至少 10 Stars、非 fork、非归档、有代码语言。过滤资料合集、教程和课程后，去重取总 Stars 前 5。**这是每日活跃项目总 Star 榜，不是 GitHub Trending，也不是当日新增 Star 榜**。每次同步使用 6 次 GitHub 搜索请求。

分类由标题、介绍与主题的确定性关键词匹配产生；保留来源原文，不使用模型编造或翻译产品介绍。各来源独立去重、独立排名。候选不足 5 个时显示实际数量。

## 生产配置

1. 在现有 Supabase 项目执行 `supabase-migrations/20261021_product_news.sql`。表启用 RLS，仅 service role 可读写；浏览器通过只读 API 获取内容。
2. 设置环境变量：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
X_BEARER_TOKEN=
PRODUCTHUNT_ACCESS_TOKEN=
# 可选，推荐配置以提高 GitHub 搜索额度
GITHUB_TOKEN=
```

`CRON_SECRET` 使用强随机字符串。X 凭证需要 Recent Search 读取权限及可用额度，Product Hunt 凭证需要 v2 API 读取权限。所有 token 仅保存在服务端，不能使用 `NEXT_PUBLIC_` 前缀。

3. 将 `frontend` 作为 Vercel 项目根目录部署。`vercel.json` 定义 `0 1 * * *`（UTC），即每天北京时间 09:00，调用 `/api/cron/product-news`。Vercel 自动携带 `Authorization: Bearer <CRON_SECRET>`。定时任务在生产部署生效；Hobby 计划可能在目标小时内触发，精确分钟取决于部署平台计划。
4. 首次部署后可在 Vercel Cron 控制台手动运行，或通过服务端工具携带相同认证请求该端点。其他托管平台也可使用其调度器在同一时间调用该端点。不要把密钥拼进 URL。

本次实现只增加项目级定时任务配置，不创建 Codex 个人提醒。未部署、未迁移数据库或未配置凭证时，线上自动采集尚未启用。

## 本地运行

从 `frontend` 目录执行：

```bash
npm run news:sync
npm run dev
```

脚本读取 `.env.local`。未配置 Supabase 时，开发模式使用 `data/.product-news.json`，文件已被 Git 忽略。生产环境必须使用 Supabase，不回退到临时文件。已成功采集的当天来源会跳过；`npm run news:sync -- --force` 可强制重抓。没有本地后台调度器，开发时按需执行脚本。

## 失败与刷新

各来源并发采集，超时 20 秒；存储请求超时 15 秒。成功来源持久化，即使其他来源失败也不会丢失结果。失败来源保留上次成功的数据和日期，页面明确提示；真实空结果会清空旧榜单。任务部分失败返回 503，允许调度器监控和重试；重复请求会跳过当天成功来源，只重试失败来源。

页面“刷新榜单”只重新读取持久化结果，不触发上游付费 API。公众只读 API 为 `GET /api/product-news`，采集端点必须验证 `CRON_SECRET`。

## 接口参考

- [X Recent Search](https://docs.x.com/x-api/posts/search-recent-posts)
- [Product Hunt posts](https://api-v2-docs.producthunt.com/query/posts/)
- [GitHub Repository Search](https://docs.github.com/en/rest/search/search#search-repositories)
- [Vercel Cron](https://vercel.com/docs/cron-jobs)
