# ProductThink Design System

> 从参考稿(Legere 学习应用,专注力分析产品)提取的设计规范与 UI Token,
> 适用于 ProductThink 全站 Web 界面。本文件是视觉事实的唯一来源(Single Source of Truth),
> 所有组件样式必须引用这里定义的 token,不允许出现新的随意色值。

---

## 1. 设计原则(从参考稿提取)

1. **纸感编辑风(Paper & Ink)**:整个产品像一张安静的纸。页面是暖灰纸底,内容放在柔和浮起的白卡上;文字是"墨"(近黑),层级靠灰度深浅表达,而不是靠彩色。
2. **几乎无彩色**:95% 的界面是墨色 + 灰阶。唯一的常驻强调色是**绿色**(用于"得分/成功"语义,如 88 分徽章);青/粉/黄/橙只作为**贴纸点缀色**,出现在营销与空状态的插画风元素中,绝不用于正文组件。
3. **衬线 + 无衬线双字体系**:品牌名与大标题用衬线体(参考稿 "Legere." 字标、会话标题),正文与数据用无衬线体;所有数字使用等宽数字(tabular-nums),时间、百分比、评分都是数据。
4. **Micro-label 系统**:分组标签、统计标签全部使用大写(英文)/加字距(中文)的小号灰字,如 `DISCIPLINE / CLOCK TIME / ENDED`、`WHAT WAS ON SCREEN`、`专注力深度分析`。标签在上、数值在下,是数据展示的固定模式。
5. **细线与药丸**:数据条是细圆角条(墨色填充 + 浅灰轨道);按钮、状态标签、徽章全部是药丸形(full rounded);卡片内部用发丝线(hairline)分隔,不用粗边框。
6. **柔和投影,不用重边框**:卡片的立体感来自大半径、低透明度的投影;边框只在输入框、次级按钮等需要精确边界的场景使用。
7. **克制的动效**:hover 抬升 1-2px、进度条 width 过渡、面板 translate 滑入;没有弹跳、没有彩色光晕。

---

## 2. 色彩 Token

### 2.1 纸与面(Surfaces)

| Token | 值 | 用途 |
| --- | --- | --- |
| `--paper` | `#ECECEA` | 页面背景(暖灰纸底) |
| `--surface` | `#FAFAF8` | 卡片、导航栏、侧栏默认底色 |
| `--surface-raised` | `#FFFFFF` | 需要更"浮"的面:弹窗、悬浮操作栏、抽屉 |
| `--surface-sunken` | `#F1F1EE` | 卡片内嵌面板、输入框底、代码块、表格行 hover |

Tailwind 类:`bg-paper` `bg-surface` `bg-surface-raised` `bg-surface-sunken`

### 2.2 墨与灰(Ink Ramp)

| Token | 值 | 用途 |
| --- | --- | --- |
| `--ink` | `#1C1C1A` | 主文字、主按钮底、数据条填充、激活态 |
| `--ink-secondary` | `#56554F` | 次级正文、描述 |
| `--ink-muted` | `#8B8A82` | 辅助说明、micro-label、时间戳 |
| `--ink-faint` | `#B9B8B0` | 占位符、禁用、最弱层级 |
| `--hairline` | `#E4E3DC` | 发丝分隔线、卡片描边、输入框边 |
| `--hairline-strong` | `#D3D2CA` | hover 边框、稍重的分隔 |

Tailwind 类:`text-ink` `text-ink-secondary` `text-ink-muted` `text-ink-faint` `border-hairline` `bg-ink`

> 兼容:旧的 Tailwind `gray-*` 色阶保留,但整体向暖灰偏移(见 globals.css),
> 遗留代码中的 `text-gray-500` 等会自动获得新色调,不需要逐一替换。

### 2.3 语义色(唯一常驻强调色:绿)

| Token | 值 | 用途 |
| --- | --- | --- |
| `--score` / `--score-bg` | `#3E8B50` / `#E2F1E2` | 得分徽章(如 "88")、完成态、成功 |
| `--warn` / `--warn-bg` | `#A87B22` / `#F6EEDB` | 风险、提醒 |
| `--danger` / `--danger-bg` | `#B9523F` / `#F8E7E2` | 删除、错误 |
| `--info` / `--info-bg` | `#44688C` / `#E6EDF4` | 中性提示、"建议"面板 |

### 2.4 贴纸点缀色(仅限营销/空状态插画)

| Token | 值 | 参考稿对应 |
| --- | --- | --- |
| `--sticker-cyan` | `#37B3D4` | 青色箭头 |
| `--sticker-pink` | `#EE7EBE` | 粉色星号、文件夹 |
| `--sticker-yellow` | `#F5CE4B` | 黄色灯泡、推荐标签 |
| `--sticker-orange` | `#EB8A2E` | 橙色铅笔 |

**规则**:贴纸色不允许作为按钮、文字链接、边框使用;只允许作为小面积图形点缀(图标、标签底、插画)。

### 2.5 状态药丸(Pill)映射

参考稿时间线的 `On task / Related / Off task / Unclear` 映射到本产品:

| 语义 | 样式 |
| --- | --- |
| 强(激活/主要) | `bg-ink text-paper`(黑底白字,如 "On task") |
| 中(相关/进行中) | `bg-surface-sunken text-ink-secondary` |
| 弱(次要/待定) | `bg-paper text-ink-muted` |
| 成功 | `bg-score-bg text-score` |
| 风险 | `bg-warn-bg text-warn` |
| 错误 | `bg-danger-bg text-danger` |

---

## 3. 字体 Token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif` | 正文、UI、数据 |
| `--font-serif` | `Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", serif` | 品牌字标、页面大标题、卡片会话标题、引言 |

Tailwind 类:`font-sans`(默认)`font-serif`

### 3.1 字号 / 字重阶梯

| 层级 | 规格 | 用途 |
| --- | --- | --- |
| Display | `text-4xl md:text-6xl font-serif tracking-tight` | 首页主标题、品牌 |
| Title L | `text-2xl font-serif` | 报告标题、弹窗主标题 |
| Title M | `text-lg font-serif` | 卡片标题、会话名 |
| Body | `text-sm leading-relaxed`(14px) | 正文、消息 |
| Data L | `text-2xl font-semibold tabular-nums` | 大数值(25:00、评分) |
| Data M | `text-sm font-medium tabular-nums` | 数值(39m、75%) |
| Micro-label | `text-[11px] font-semibold tracking-[0.12em] uppercase text-ink-muted` | `DISCIPLINE`、`WHAT WAS ON SCREEN`、`专注力深度分析`(工具类 `.micro-label`) |
| Caption | `text-xs text-ink-muted` | 说明、时间戳、页脚 |

**数字永远用 `tabular-nums`**(Tailwind 类 `tabular-nums`),时间、百分比、分数皆同。

---

## 4. 几何 Token

### 4.1 圆角

| Token | 值 | 用途 |
| --- | --- | --- |
| 圆角 XL | `rounded-2xl`(16px) | 卡片、弹窗、抽屉 |
| 圆角 L | `rounded-xl`(12px) | 卡片内嵌面板、列表项 |
| 圆角 M | `rounded-lg`(8px) | 小块面板 |
| 药丸 | `rounded-full` | 按钮、徽章、状态标签、输入框、数据条 |

### 4.2 阴影

| Token | 值 | 用途 |
| --- | --- | --- |
| `--shadow-card` | `0 1px 2px rgb(28 28 26 / 0.04), 0 20px 44px -28px rgb(28 28 26 / 0.28)` | 默认卡片(参考稿的柔和浮起) |
| `--shadow-float` | `0 2px 6px rgb(28 28 26 / 0.06), 0 28px 64px -28px rgb(28 28 26 / 0.38)` | 弹窗、悬浮操作栏、抽屉 |

Tailwind 类:`shadow-card` `shadow-float`

### 4.3 间距与容器

- 页面水平内边距:`px-4`,内容最大宽度:常规页 `max-w-4xl` / 阅读页 `max-w-3xl` / 宽表页 `max-w-6xl`。
- 卡片内边距:`p-6`(大卡)`p-4`(小卡);卡片间距 `gap-4~6`。
- 区块间距:`mb-6` 统一节奏。

---

## 5. 组件规范(参考稿逐一对应)

### 5.1 卡片 Card
白面、`rounded-2xl`、`shadow-card`,默认**无边框**;需要边界时用 `border border-hairline` 且去投影(工具类 `.card-outline`)。卡片头部与内容之间用发丝线分隔。

### 5.2 按钮

| 类型 | 规格 |
| --- | --- |
| Primary `.btn-primary` | `bg-ink text-paper rounded-full font-medium hover:bg-ink/85`,"Start session / NOW IN BETA" 式黑药丸 |
| Secondary `.btn-secondary` | `bg-surface-raised border border-hairline text-ink rounded-full hover:border-hairline-strong` |
| Ghost `.btn-ghost` | 无边框,`text-ink-secondary hover:text-ink`,用于"返回/取消" |
| Danger | secondary 形态 + `text-danger border-danger/30` |

尺寸:大 `px-6 py-3 text-sm` / 中 `px-4 py-2 text-sm` / 小 `px-3 py-1.5 text-xs`。

### 5.3 输入框 `.input-field`
`bg-surface-sunken rounded-full`(单行)或 `rounded-xl`(多行),`border border-transparent focus:border-ink/30 focus:bg-surface-raised`,placeholder `text-ink-faint`。带图标时图标在左、色 `text-ink-faint`。

### 5.4 数据条(参考稿核心组件)

- **细指标条**:轨道 `h-1.5 rounded-full bg-hairline`,填充 `bg-ink rounded-full`;行结构 = 左标签 13px + 中条(flex-1)+ 右数值 `tabular-nums`。用于 Time worked/Continuity/Task focus 式指标、评分条。
- **粗药丸条**:轨道 `h-2.5 rounded-full bg-surface-sunken`,填充 `bg-ink`(带 `shadow-[0_1px_0_rgb(28_28_26/0.15)]` 的轻微厚度感)。用于 App 占用时长列表。
- **分段时间条**:总高 `h-3.5 rounded-md`,段间 2px 白缝;`on-task=bg-ink`、`related=bg-[#8E8D85]`、`idle=bg-hairline`。

### 5.5 统计组(Stat Block)
Label(micro-label)在上 + 数值(`text-lg font-semibold tabular-nums`)在下,横向排列 `gap-8`,参考稿 `DISCIPLINE Unbroken / CLOCK TIME 1h 27m / ENDED 18:08`。

### 5.6 徽章与状态药丸
- 得分徽章:`bg-score-bg text-score rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums`(参考稿绿色 "88")。
- 状态药丸:见 2.5,`px-2.5 py-1 text-[11px] font-medium rounded-full`。

### 5.7 链接
文本链接一律下划线 `underline underline-offset-2`(参考稿 "Hide every window"、"Delete session"),色同正文,hover `text-ink`。

### 5.8 分段控制(参考稿 Today/History/Stats 导航)
容器 `bg-surface-sunken rounded-full p-1`;激活项 `bg-surface-raised shadow-sm text-ink`(浅色激活)或 `bg-ink text-paper`(强调激活),未激活 `text-ink-muted`。

### 5.9 贴纸(Sticker)装饰
仅营销页(首页)与空状态使用:lucide 图标 + 贴纸色 + 轻微旋转(`-rotate-12` 等) + 描边感(`stroke-[2.5]`)。数量克制:一屏 ≤ 4 个。

### 5.10 Micro-label(工具类)
`.micro-label` —— 11px、600、`tracking-[0.12em]`、`uppercase`(对中文加字距同样生效,参考稿"专 注 力 深 度 分 析")、`text-ink-muted`。所有分组标签、统计标签、眉标(eyebrow)统一使用。

---

## 6. 页面级映射(ProductThink 落地)

| 页面/组件 | 应用 |
| --- | --- |
| 全局 | `body.bg-paper.text-ink`;导航栏 `bg-paper/85 backdrop-blur`,发丝线底边 |
| Navbar | 字标改衬线 `font-serif "ProductThink."`;导航分段控制;头像药丸 |
| 首页 | 衬线 Display 标题 + 黑药丸 CTA + 双入口卡片 + 贴纸点缀 |
| Chat | 消息:用户=黑药丸气泡,AI=`surface-raised`+hairline;输入框药丸;阶段条 = 分段控制;右侧栏卡片化 |
| Analysis | 专家卡片选中态 `border-ink`;报告头部复刻参考稿会话卡(时间/标题/副题/绿色得分徽章/细指标条/统计组) |
| Explore | 分类药丸、洞察卡片(引言用衬线体) |
| Knowledge | 头部横幅改墨色卡(呼应黑药丸 CTA),检索/文档卡纸感化 |
| 状态色 | 成功/得分=绿,风险=暖黄,错误=砖红,进行中=墨(不再出现 indigo/violet 大面积色) |

---

## 7. Do / Don't

- ✅ 用灰度深浅表达层级;❌ 用新增彩色表达层级。
- ✅ 数字 `tabular-nums`;❌ 比例字体数字对齐时间轴。
- ✅ 大标题衬线、正文无衬线;❌ 全站衬线或全站粗黑。
- ✅ 投影柔和大半径;❌ 高透明度黑色硬阴影、粗边框卡片。
- ✅ 贴纸色只做点缀;❌ 贴纸色进表单/按钮/表格。
- ✅ 语义色只允许 token 中定义的四组;❌ `indigo-*/violet-*/emerald-*/slate-*` 等 Tailwind 原色阶(遗留引用会随灰阶重映射逐步清理)。
