# 项目协作约束

## 项目状态与目标

Holdem Lab 是 No-Limit Texas Hold'em 科普、学习、练习和复盘产品。它只使用虚拟筹码，不连接真实牌桌，不处理真实资金、奖金或可兑现资产，不提供实时游戏辅助，不承诺盈利。

Holdem Lab 是独立的 MIT 开源项目。Rails 8.1 + SQLite + Vite Ruby/React 承载产品，纯 TypeScript 引擎拥有牌局状态。本仓库只包含当前应用、必要测试和经过筛选的文档，不包含旧 Git 历史、历史 prototype、附件范围表、部署密文或旧运维日志。原始作者在 LICENSE 中保留。

当前包含双语课程、训练与回放、内容 registry/publication gates、Rails 原生账户、profile、owner-scoped export 和账户删除。自动跨设备同步、支付、独立领域审核及学习效果验证未完成。内容 owner approval 不等于 source packet 的独立审核。以代码、测试、ROADMAP.md 和最新 .logs/ 为准。

本地 bin/setup 安装 Ruby/npm 依赖、准备 SQLite 并导入校验内容。bin/dev 仅监听回环地址，Rails 为 3100，Vite 为 3036。默认没有外部 analytics ID，生产 product telemetry 需显式启用。部署配置是通用示例，CI 部署必须同时满足手动输入和 ENABLE_DEPLOY=true。

后续工作遵循下列边界。

## 不可违反的产品边界

- 不连接或控制任何真实牌桌、博彩平台、钱包、经纪商或资金账户；
- 不提供实时牌局辅助、HUD、自动下注、奖金、排行榜奖金或可兑现筹码；
- 不使用“稳赚”“保证盈利”“击败赌场”等文案；
- 产品和公开内容面向成人教育，清楚说明结果波动与教育用途；
- 不把付费能力设计成购买虚拟筹码或参加有奖游戏。

## 规则引擎拥有牌局状态

- 发牌、洗牌、行动方、合法动作、下注额度、底池、街道推进、摊牌和结算只能由纯 TypeScript 规则引擎决定；
- React、Rails、SQLite、浏览器存储、后台工具和语言模型都不得直接修改 `GameState`；
- 所有动作先转换为领域动作，再由引擎返回新状态或结构化错误；失败动作不得改变原状态；
- Rails 可以保存、授权和校验记录 schema，但不得实现第二套 Ruby 规则来“修正”牌局；
- domain 不得依赖 React、DOM、Rails、网络、`localStorage`、系统时钟或模型 SDK。

## 随机必须可重放

- 业务牌局代码禁止使用 `Math.random()`；
- 洗牌使用显式 seed、固定算法版本和可测试 Fisher–Yates；
- 快照保存 seed、算法/规则/评估器版本和动作序列；相同输入必须得到相同结果；
- 生成记录 id 可使用与牌局随机隔离的安全机制，但不能影响牌面；
- 语言模型、Rails 回调或脚本不能决定牌面、下注结果或修正状态。

## 规则正确性优先

- 当前引擎范围固定为 heads-up、100BB、标准 52 张牌、纯虚拟筹码；
- 必须持续测试牌堆唯一性、最小加注、all-in、未跟注返还、底池守恒、摊牌、踢脚牌和 split pot；
- 必须覆盖 A2345 wheel、公共牌成牌、完全平局和终局后拒绝动作；
- 不引入未获再分发授权的 attachment、静态 equity 或 6-max preflop 数据；未审核内容不得作为当前练习、规则或策略基线；
- 扩展 6-max 前先完成多人行动顺序、side pots、all-in 和结算设计与测试，不能在 UI 特判。

## 策略反馈必须诚实

持久化反馈只使用语言无关 code，当前英语展示由 UI 边界映射：

- `benchmark_strategy` → `Benchmark strategy`：有项目基线、版本、适用范围和来源；
- `approximate_analysis` → `Approximate analysis`：透明算法、范围假设、样本、版本和不确定性；
- `solver_data` → `Solver data`：可核验 solver、版本、参数、覆盖范围和使用许可。

没有证据的建议不得标为 solver 数据，也不得声称绝对 GTO。证据不足时返回“不足以估算”或 null，不用小数制造精确感。当前随机对手 + 即时成本 EV 只是原型近似，正式产品必须限制或重构其展示。

语言模型最多辅助整理文字或提出复盘问题；它不能成为状态机、策略结论、证据标签或 SEO 发布的权威。

## 决策记录不可丢失或改写上下文

每个决策记录保留：位置、手牌、公共牌、有效筹码、底池、对手行动、完整动作序列、合法动作、用户选择、理由、信心、反馈、赔率、权益/EV 方法、错误标签、seed、版本、原始和结果快照。

- 原始 `DecisionRecord` 写入后只追加关联 `ReviewNote`，不覆盖历史；
- 复盘必须重放原 seed 和版本，不能重新随机；
- 本地到 Rails 导入使用稳定 id 幂等；失败不得删除本地原件；
- 当前 `/api/v1/imports/local_progress` 与显式 `RailsProgressImporter` 只用于 development/test 的版本化、同源、CSRF 保护 contract；production 默认关闭并返回 `404 import_disabled`，UI 不提供导入动作。不得在 `TrainerApp` 或 `LocalProgressRepository` 中自动上传；任何生产启用必须先完成认证、授权、限流、保留期限、导出/删除和运维复核；
- progress、掌握度和推荐是可重建派生数据，不替代原始事实；
- 第三方 analytics/monitoring 不发送 hole cards、理由全文、email 或完整 snapshot。
- 当前 `app/frontend/telemetry/events.ts` 只在 Rails development/test boot meta 明确启用时派发五类 DOM event；没有 fetch、cookie、localStorage、第三方 SDK、用户/安装标识、URL、时间戳或训练内容 payload。production 默认关闭；未来若要增加 collector，必须先重新审查 allowlist、同意/隐私政策、保留期限和访问权限。

## Rails 与 React 边界

目标依赖方向：

```text
Rails SSR / Turbo / Stimulus
└─ React UI -> TS application/use-cases -> TS domain
                                     \-> strategy/advisory（只读）
React persistence adapter -> Rails same-origin JSON endpoints -> Active Record
```

- Rails 负责内容、SEO、账户、授权、持久化、进度、entitlement、账单和运营；
- React 负责训练、复盘时间线和高交互视图；
- Vite Ruby 是唯一 JS 构建入口，不并存 importmap/jsbundling 的重复方案；
- 普通 Rails 页面优先 ERB + Turbo/Stimulus，不为每个页面挂 React；
- React 只依赖 repository 接口，不在组件散落 `localStorage` 或 fetch；
- 同源浏览器认证使用 session + CSRF，不为当前 Web SPA 另建 JWT 体系；
- 不在 foundation 一次性安装 Devise、Pay、Madmin、Active Storage、LLM 等未进入里程碑的依赖。

## SQLite 生产约束

- SQLite 是早期正式数据库；production 必须有持久本地卷和恢复方案；
- primary、cache、queue 使用独立文件；Action Cable 有真实需求后再增加 cable；
- Web 与 jobs 运行在同一主机/本地存储边界内，不通过网络文件系统共享 WAL；
- 保持短事务，监控 busy/locked、写等待、WAL/文件大小和磁盘；
- 备份使用一致性快照工具，并定期在隔离环境恢复验证；
- 需要多主机写、持续锁争用、HA、复杂搜索/分析或更严格恢复目标时，启动 PostgreSQL 迁移；
- migrations 和数据类型保持适配器可移植，避免 SQLite 特有 SQL 成为业务依赖。

## 内容与来源治理

- 核心课程、练习模板、策略基线和来源元数据优先保存在版本库 `data/`，再幂等镜像到 SQLite；
- published 内容必须有稳定 slug、版本、作者/审核状态、来源和 rights status；
- 附件、社区帖子和竞品内容在许可与事实审核前只用于研究或内部草稿；
- `data/research` 是候选登记层，不是 published/canonical 数据；晋级前必须固定具体资产版本、SHA-256、rights、integrity 和领域审核状态；
- 运行 `npm run validate:research` 只能证明研究登记结构有效；运行 `npm run validate:quality` 和 golden scenario tests 只能证明 packet 结构、引用和自动化预期通过。它们都不能替代外部内容授权、独立领域审核或发布审核；
- 不抓取或再发布未授权 solver 数据；
- 英语为默认无前缀 canonical；中文通过 `/zh` 提供独立 authored sibling，不做机械翻译；
- SEO 内容必须为读者提供原创解释或练习价值，不批量制造薄页面。

## 认证、支付与权限

- 匿名用户必须可以完成首次核心练习；注册用于同步和长期进度；
- 账户方案在 Milestone 15 只选一套：Rails 原生 auth 或经明确理由选择 Devise；
- 产品权限使用 `Entitlement`，不能只用 `premium` 布尔值；
- 支付阶段优先 Stripe hosted Checkout/Portal，应用不直接收集卡号；
- webhook 必须验签、幂等并处理重复/乱序；test/live 配置严格分离；
- 真实支付、平台业务审核、邮件送达和退款流程都是人工外部门，不由本地测试替代。

## 实现顺序

1. 先建立可恢复源码基线，再生成 Rails skeleton；
2. Rails/SQLite/Vite/CI 基础；
3. 迁移纯 TypeScript 引擎与全部测试；
4. 迁移 React UI 并达到原型 parity；
5. 实现课程→练习→总结垂直切片；
6. 内容来源与 SQLite 镜像；
7. 账户和匿名导入；
8. 云端 review/progress；
9. 留存成立后才做支付；
10. 部署、备份恢复、SEO beta；
11. 根据真实数据决定 6-max、多语言和高级分析。

## 测试、文档和事实边界

- 规则/数据测试先于 UI；
- 每个里程碑运行当时存在的 Rails tests、Vitest、typecheck、build、system smoke、内容校验和安全扫描；
- `bin/ci` 建立后成为统一完整门；
- 每个里程碑在 `.logs/` 写日期、范围、确切命令、真实结果、未运行项、已知限制和外部人工门；
- 当前行为以代码、测试和最新日志为准；计划和聊天不能证明实现、上线、用户或业务结果；
- 文档主题只保留一个当前所有者，索引见 `docs/README.md`；
- 变更后检查 diff、实际路径、秘密和数据库文件；
- 没有用户明确要求，不连接外部服务、不发送数据、不提交或推送远程仓库；
- 不复制其他项目的秘密、无关依赖、未授权内容或产品规则。

## 当前下一步

先确保本地可运行与核心规则正确，再依据 ROADMAP.md 选择有证据的小改进。文档入口是 README.md 和 docs/README.md。记录确切命令、真实结果、未运行项与外部门，不复制旧运维资料或完整对话。未经用户明确授权，不部署、推送、改仓库可见性、引入外部采集器或启动长期服务。文档站暂不增加构建系统。
