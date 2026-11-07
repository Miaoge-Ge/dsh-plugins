# Code 模式预设

DeepSeek Harness 的本地编码模式插件，沿用标准工具目录，增加直接实施、控制修改范围并运行项目检查的编码工作方式。

```powershell
dsh plugin --profile desktop add "C:\path\dsh-plugins\dsh-code-mode-preset"
```

完全退出并重新打开 Harness，在新会话的 Agent 预设中选择 **Code 模式**。

这是 DSH 插件合集中的 Code 模式预设，统一版本为 0.0.1。主要配置位于 `cordis.patch.yml`，需要 DeepSeek Harness 0.2.2-rc.1 或兼容版本。

卸载：`dsh plugin --profile desktop remove @local/dsh-code-mode-preset`。
