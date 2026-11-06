# 主机认证管理插件 0.1.4

## Highlights

- 修复密码模式“待确认”列表在旧宿主上被全部过滤的问题：宿主返回的密码待确认账户本身已是 pending-only 列表，缺少 `pending` 字段时按待确认处理。
- Vault 验证授权收紧：宿主全局已解锁不再等于本面板已授权，必须显式点击“解锁 Vault”并通过宿主返回校验后才能读取账户。
- 宿主重新上锁、外部状态变更或切换操作模式都不会静默恢复授权；验证失败会清空账户、选择与结果。
- 错误提示按类型区分：只有真正的接口/方法不支持才提示更新宿主，业务失败（连接失败、取消验证、主口令错误）保留原始原因。
- “处理待确认”按钮与入口双重校验待确认状态，账户状态已过期时先刷新列表再报错，不再需要手动刷新。

## Notes

### 待确认恢复

- `refresh()` 对密码模式兼容旧宿主：`result.recoveryProfiles` 已是待确认列表，缺少 `pending` 字段时补 `pending: true`，避免被 `pending === true` 过滤条件清空。
- 密钥模式仍只从 `profiles` 中取 `pending === true` 的账户。
- “处理待确认”按钮仅在选中的单个账户确实处于待确认状态时可用。
- `recoverProfile()` 增加入口校验，程序化调用也会被拒绝，不会发出 RPC。
- 宿主返回“没有待确认操作”时先刷新账户列表（清除已过期的待确认状态），再抛出原始错误，不再把这种情况误报为版本不兼容。

### Vault 验证

- 新增 `clearVaultVerification()`：统一清空 `vaultUnlocked`、`listReady`、分组、账户、待确认列表、选择、密码历史与结果区，并恢复默认空态文案。
- 弹窗加载后不再自动读取业务列表：全局 Vault 已解锁不构成本面板的授权。
- “解锁 Vault”校验宿主返回 `unlocked === true`，否则按失败处理；成功后才读取列表。
- 解锁按钮文案随状态变化：`解锁 Vault` / `正在验证 Vault…` / `Vault 已验证`。
- 解锁前先递增操作代次并清空验证状态，避免并发点击或旧响应写回旧状态。
- `refresh()` 在未验证时直接清空并提示，不再调用 `list` 探活。
- `list` 返回 `encrypted !== true` 或 `unlocked !== true` 时清空验证状态。
- 刷新、切换模式、外部 `issh-plugin-host-state-changed` 通知都不会恢复授权；必须重新点击解锁。
- 任务轮询在未验证时每秒重试等待，不再继续发 `status`；结果渲染同样要求验证通过。

### 错误分类

- `operationError()` 只在 `unknown/unsupported/unrecognized method`、`method not found`、`不支持 hostKey./方法/接口` 等模式命中时追加“旧版本需更新”的说明。
- 连接失败、用户取消验证、主口令错误、契约校验失败等保留原始错误文本，避免误导用户升级。

### 测试

- `test/sandbox-behavior.test.mjs` 从 5 条路由的静态契约扩展为 48 条 RPC 的行为覆盖：
  加载不发业务 RPC、三模式 × 程序化入口绕过防护、`unlock` 返回值异常（`{unlocked:false}`、`{}`、`null`）、解锁失败文案回退、旧宿主待确认列表可用、正常/待确认/过期待确认三态、宿主重新上锁后无法恢复授权、错误分类断言。
- 测试通过：`sandbox-behavior: PASS (48 RPC calls; explicit verification, three modes, pending recovery, error classification and relock)`。

### 兼容性

- 版本 `0.1.4`，`minAppVersion` 保持 `0.2.0`。
- 仅插件面板行为变更，宿主与 Runtime 接口未改动，可直接升级覆盖 0.1.3。
