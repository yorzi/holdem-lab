# Local Progress Import Contract

> 公开源码合同 · 2026-10-19。v2 同源 JSON contract、versioned local outbox、显式账户绑定与账户导出在 development/test 可用；production 默认关闭；没有自动同步或真实部署。

## 目的与环境门

这个 contract 允许用户明确选择，把匿名浏览器中的当前版本 `DecisionRecord` 复制到 Rails。它不是 `/practice` 的自动行为：`TrainerApp` 通过 `ResilientProgressRepository` 先写本地 review 和 versioned outbox，只有 Review Queue 的显式按钮才会将 pending entries 交给 `RailsProgressImporter`。成功/duplicate/claimed 后 outbox 保留可校验的 `synced` 标记；网络失败或冲突不会清空 pending payload 或本地原件。请求带有当前 Rails session 时，新记录归属于该用户；同一安装范围内已有的匿名同 payload 记录也只在这次明确导入时被 claim。

环境策略是 deny by default：

- application 默认值和 production 都是 `config.x.local_progress_import_enabled = false`；endpoint 返回 `404 import_disabled`，页面 boot capability 为 false，UI 不发请求；
- development/test 显式设为 true，用于 contract、幂等和错误恢复验证；
- 不能仅用环境变量临时打开 production。未来若要启用，必须先实现认证、资源授权、限流、保留期限、导出/删除、监控和恢复策略，并单独复核本合同。

匿名 `installation_id` 仍只是幂等范围，不是账户身份、授权凭证或跨设备同步方案。`user_id` 由 Rails 当前 session 推导，客户端不能提交或覆盖它。

## Endpoint

```text
POST /api/v1/imports/local_progress
Content-Type: application/json
Accept: application/json
X-CSRF-Token: <same-origin Rails token>
```

以下是省略牌局内部字段后的 v2 envelope；真实 `snapshot` 和 `resultState` 必须是完整的当前版本 `GameState`：

```json
{
  "version": "holdem-progress-v2",
  "installation_id": "install-001",
  "records": [
    {
      "version": 2,
      "id": "decision-001",
      "mode": "quiz",
      "street": "preflop",
      "heroPosition": "button",
      "userReason": "The button acts first preflop.",
      "feedback": { "label": "approximate_analysis" },
      "errorTags": ["poor_bet_sizing"],
      "ruleVersion": "holdem-rules-v2",
      "evaluatorVersion": "holdem-evaluator-v1",
      "rngAlgorithmVersion": "mulberry32-fisher-yates-v1",
      "createdAt": "2026-08-20T00:00:00.000Z",
      "snapshot": {
        "ruleVersion": "holdem-rules-v2",
        "evaluatorVersion": "holdem-evaluator-v1",
        "rngAlgorithmVersion": "mulberry32-fisher-yates-v1"
      },
      "resultState": {
        "ruleVersion": "holdem-rules-v2",
        "evaluatorVersion": "holdem-evaluator-v1",
        "rngAlgorithmVersion": "mulberry32-fisher-yates-v1"
      }
    }
  ]
}
```

边界：

- envelope 必须是 `holdem-progress-v2`，record 必须是 version `2`；v1 和未知版本返回 `422`，不猜测或静默迁移；
- record、`snapshot`、`resultState` 三层都必须匹配 `holdem-rules-v2`、`holdem-evaluator-v1` 和 `mulberry32-fisher-yates-v1`；
- 持久化位置、反馈和错误标签必须使用 code：`button|bigBlind`、`benchmark_strategy|approximate_analysis|solver_data`、`over_calling|over_folding|poor_bet_sizing`；英语仅是展示映射；
- `installation_id` 必须是 8–128 个 URL-safe 字符；单次最多 1,000 条记录，原始 body 最多 2 MiB，单条 `userReason` 最多 2,000 bytes；
- `createdAt` 必须是有效 ISO 8601，record id 最多 200 字符；
- Rails canonicalize 后保存原始 JSON 字符串和 SHA-256 digest，不生成第二套牌局状态，也不覆盖客户端上下文；`false`、`0` 和 `null` 必须保真；
- 数据库唯一键是 `installation_id + client_id`；当前用户只能读取/绑定自己拥有的 imported row，另一账户重复提交会返回稳定的 `record_owner_conflict`，不能改写 owner。

成功响应：

```json
{
  "version": "holdem-import-v2",
  "accepted": ["decision-001"],
  "duplicates": [],
  "claimed": [],
  "conflicts": []
}
```

同一 installation 内，相同 client id 和相同 payload 是 no-op duplicate；匿名 row 在登录后由同一明确导入动作绑定到账户时返回 `claimed`；相同 id 但 digest 不同返回 `409 client_id_conflict`，不覆盖第一次导入；其他账户触碰已拥有 row 返回 `409 record_owner_conflict`。并发唯一键竞争返回 `409 import_race`。校验错误返回稳定 `error.code` 和英语 message，不泄露异常堆栈。

## 浏览器与旧版本行为

`LocalProgressRepository` 只读写 `holdem-lab:progress:v2`。旧 `holdem-lab:progress:v1` 原样保留，UI 只提示其存在；因为 v1 heads-up 发牌顺序与 rules v2 不兼容，当前代码不会自动迁移或重放它。

`LocalProgressOutbox` 与 `RailsProgressImporter`：

- outbox 使用独立的 `holdem-lab:progress-outbox:v1` key；本地 review 写成功后 pending entry 压缩为 client id、状态和 payload fingerprint，显式导入时再从本地原件补齐；写入失败或已 staged 的请求仍保留完整 payload，synced entry 也只保留 compact marker，避免长期双份占用 localStorage；
- 用户第一次点击导入时，当前 local records 会被幂等地补入 outbox；之后只发送 pending entries。相同内容的已 synced record 不会因为重复打开 Review Queue 而自动重新上传；`claimed` 与 `accepted`/`duplicates` 一样会完成 synced 标记；
- stable `DecisionRecord.id` 仍是 client id，改变同一个 id 的内容会重新进入 pending，服务器冲突不会自动覆盖已有记录；
- outbox 写入失败或本地 review 写入失败会保留可恢复边界，不静默淘汰既有记录，也不自动发起网络请求；

`RailsProgressImporter`：

- 在发送前校验每条本地记录及其三层 engine versions；
- 使用 same-origin credentials 和 Rails CSRF meta token；
- 只解析 `holdem-import-v2`，未知 response version 作为 `invalid_response`；
- 任何成功、duplicate、claimed、conflict、校验或网络结果都不清空、不改写本地记录；
- 当 Rails boot capability 为 false 时，Review Queue 只显示 production-disabled 说明，不创建 installation id，不调用 endpoint。

## 日志与数据最小化

Rails 参数过滤器覆盖 installation/client identifiers、批量 `records`、canonical payload/digest、seed、理由、hole/public cards、snapshots、result state、feedback 和 action history。应用日志不应输出完整决策 payload。M13 的 telemetry 目前只是 development/test 可监听的无网络 DOM event；它不改变 import contract，也不接收 hole cards、理由全文、email、完整 snapshot、URL 或时间戳。未来 analytics/monitoring 也不得绕过这条最小 allowlist。

## 账户资料与导出

已登录用户可访问 `GET /settings/profile`，更新可选 display name，并通过 `GET /settings/profile/export` 下载 `holdem-lab-account-export-v1` JSON。导出包含账户字段、session 元数据和当前账户拥有的 imported progress；不包含 `password_digest`、session cookie 或其他账户的记录。尚未导入的浏览器本地 progress 不属于服务器账户数据，仍留在浏览器。

已登录用户也可以向 `DELETE /settings/profile` 提交当前密码和精确的大写确认词 `DELETE`。验证通过后，服务端在事务中删除账户、该账户的 session 和其拥有的 imported progress；匿名记录（`user_id` 为空）不会被删除。验证失败时不做任何删除。该操作不会清理尚未导入的浏览器本地 progress，也不代表 production retention、恢复和完整数据生命周期已经完成。

## 尚未完成

- 完整数据保留期限、production 导出/删除、更细的生产资源授权，以及浏览器本地数据的独立清理策略；
- 自动/后台同步、定时重试、跨设备同步和生产环境启用；当前重试只由用户再次点击导入触发；
- 云端 `PracticeSession`、`ReviewNote`、progress 派生数据和多用户 review API；
- production 部署、备份恢复、监控、滥用测试和隐私审核。

以上工作属于 M15/M16 或 production gate，不因当前本地 contract 和测试通过而提前标记完成。

## 证据

- `test/controllers/api/v1/imports_controller_test.rb`：环境关闭、v2 导入、duplicate、changed-payload conflict、v1/字段/version/code 拒绝和 payload 保真；
- `test/frontend/application/rails-progress.test.ts`、`test/frontend/application/progress.test.ts`：v2 envelope、同源/CSRF、旧 key 保留、坏记录和旧版本拒绝；
- `test/frontend/application/local-outbox.test.ts`：versioned pending/synced entries、unchanged duplicate marker、changed-content requeue、local-write rollback 和 acknowledgement filtering；
- `test/frontend/application/rails-progress.test.ts`：`claimed` response contract；`test/controllers/settings/profiles_controller_test.rb`：账户资料、locale、owner-scoped export 和匿名记录隔离；
- `test/services/accounts/deletion_test.rb`、`test/controllers/settings/profiles_controller_test.rb`：当前密码 + `DELETE` confirmation、失败无副作用、服务端 owner/session 删除和匿名/其他账户记录隔离；
- `test/system/practice_test.rb`：显式导入能力、success/duplicate/conflict/网络失败，以及关闭时不出现导入动作；
- `config/application.rb`、`config/environments/*`、`config/initializers/filter_parameter_logging.rb`：deny-by-default 环境门与日志过滤；
- `app/controllers/api/v1/imports_controller.rb`、`app/models/imported_decision_record.rb`、`db/migrate/20260819225000_create_imported_decision_records.rb`、`db/migrate/20260821153000_add_account_profile_and_progress_ownership.rb`：Rails import/ownership 实现；`app/services/account_data_export.rb`、`app/services/accounts/deletion.rb` 与 `app/controllers/settings/profiles_controller.rb`：账户导出/profile/服务端删除实现。
