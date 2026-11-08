# Code 模式预设

DeepSeek Harness 的本地编码模式插件：沿用标准工具目录，改成动手实施、守住用户 Git 工作树、改完自己跑检查的编码工作方式，并额外挂载内置的 Git 工作树、持久终端与先读后写保护。

```powershell
dsh plugin --profile desktop add "C:\path\dsh-plugins\dsh-code-mode-preset"
```

完全退出并重新打开 Harness，在新会话的 Agent 预设中选择 **Code 模式**。

## 包含什么

- **编码人格**：先勘察仓库（`AGENTS.md`、锁文件、构建与测试命令），再动手；复用既有函数与命名，改动只覆盖请求范围。
- **Git 纪律**：动手前看 `git status` 与 `git diff`，不擅自 commit、amend、push、改历史或动 `.git`；用户要求提交时只暂存本次改动的路径，按仓库最近的 `git log` 风格写提交信息，并报告仍留在工作区的改动。
- **验证要求**：改完按「类型/编译 → 覆盖改动的测试 → lint → 更宽的套件」向外推进，渲染类改动要看实际输出；汇报每条命令与结果，并说明哪些没能验证。
- **Git 工作树**：`create_worktree` 从本地提交新建隔离工作树并把会话目录切进去，`working_directory` 可切回；分支与目录会保留供复查。
- **持久终端**：`terminal_open`、`terminal_send`、`terminal_read`、`terminal_signal`、`terminal_close`、`terminal_list`，Windows 使用 pwsh、POSIX 使用 bash，适合 REPL、交互式调试器和后台 dev server；收尾时关闭自己开的会话。
- **先读后写保护**：`edit` 需要本会话先读过，`write` 不能覆盖没读过的文件，基于过期读取的写入会被拒绝（`FS_NOT_OBSERVED` / `FS_STALE_VERSION`），而不是覆盖别人刚改的内容。保护覆盖 `read`、`write`、`edit` 三个文件系统工具；本预设不挂载删除工具。
- **计划模式**：仍然挂载但默认关闭，需要时可以切换。

## 先读后写保护的作用范围

保护由 `@deepseek-ai/dsh-fs-observation-policy` 提供，它是纯事件 gate，监听 `tool-fs` 派发的 `fs/write-intent`、`fs/edit-intent`、`fs/delete-intent` 与 `fs/observed`。这些事件没有作用域过滤（已在 cordis 4.1.0 上实测：预设内监听器会收到其他插件的 intent，也会替它们做决定），所以保护**不能按预设隔离**。本插件因此把它挂在 Host 层：

- 安装本插件后，**该 profile 下所有会话**（包括其他预设）都会启用先读后写保护，不只是 Code 模式。
- 只覆盖文件系统工具；`pwsh`/`bash` 里的重定向、脚本与构建产物不受约束。
- 想关掉时，在自己的 profile patch 里加一行：

```yaml
- id: fs-observation-policy
  disabled: true
```

## 依赖

需要 DeepSeek Harness 0.2.2-rc.1 或兼容版本，主要配置位于 `cordis.patch.yml`。Git 工作树需要本机 `git`；持久终端在 Windows 需要 pwsh、在 POSIX 需要 bash。`@deepseek-ai/dsh-experimental-worktree` 与 `@deepseek-ai/dsh-experimental-tool-worktree` 属于 Harness 的实验性包，随 Harness 一起提供。

## 开发

修改 `cordis.patch.yml` 后运行：

```powershell
npm.cmd run check --workspace dsh-code-mode-preset
```

测试会校验补丁能否解析、行 id 是否唯一、先读后写保护是否按 id 覆盖而不是重复插入、终端与工作树分组是否保留隔离、平台切换表达式是否存在，以及人格是否守住 Git 纪律、收尾纪律与字数预算。

这是 DSH 插件合集中的 Code 模式预设，独立升版，当前为 0.0.4。授权见同目录的 [LICENSE](./LICENSE)。

卸载：`dsh plugin --profile desktop remove @local/dsh-code-mode-preset`。
