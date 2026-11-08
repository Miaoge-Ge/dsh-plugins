# DSH 插件 · DeepSeek Harness Plugins

DeepSeek Harness 的三个插件，一个仓库统一维护。三个插件独立升版：用量计费为 **0.0.6**，主题工坊为 **0.0.6**，Code 模式为 **0.0.4**。

| 插件 | 目录 | 功能 |
| --- | --- | --- |
| 用量计费 | [dsh-session-cost](./dsh-session-cost) | 范围化消费主数字、账户余额、逐模型可展开明细、分时/每日趋势、输入框计费浮层、CSV、自定义单价 |
| 主题工坊 | [dsh-theme-atelier](./dsh-theme-atelier) | 六套参考成熟设计系统的明暗配色 + DSH 原生、当前方案预览、原生明暗同步与持久化 |
| Code 模式 | [dsh-code-mode-preset](./dsh-code-mode-preset) | 直接实施、Git 纪律与工作树、持久终端、先读后写保护、运行项目检查的编码预设 |

## 安装

需要 Node.js 20+、npm，以及已安装的 DeepSeek Harness。当前适配 Harness **0.2.2-rc.1**。

```powershell
git clone https://github.com/Miaoge-Ge/dsh-plugins.git
cd dsh-plugins
npm.cmd ci --ignore-scripts
npm.cmd run check
.\scripts\install.ps1
```

安装脚本将三个插件链接到当前源码目录。完全退出并重新打开 Harness 后生效。不要移动或删除源码目录；迁移后重新执行安装脚本即可更新引用。Web 配置可使用 `.\scripts\install.ps1 -Profile web`。

也可只安装其中一个插件：

```powershell
dsh plugin --profile desktop add "C:\path\dsh-plugins\dsh-session-cost"
```

**使用入口**：账号菜单 → 设置 →「用量计费」「主题工坊」；新建会话的 Agent 预设中选择「Code 模式」。计费工具也提供输入框下方入口。

## 开发与打包

仓库根目录统一管理 npm workspaces 与锁文件，不包含嵌套 Git 仓库。

```powershell
npm.cmd run build         # 构建两个客户端插件
npm.cmd test              # 运行计量、余额与主题测试
npm.cmd run check         # 元数据/YAML 校验、构建、语法检查与测试
npm.cmd run pack:plugins  # 在 dist/ 生成三个安装包
```

`client.js`、`catalog.js` 是构建产物，修改对应 `src/` 后重新构建。修改后需重新加载 Harness。仓库的 `private: true` 仅防止误发布到 npm；GitHub 仓库是公开的。

## 计费与隐私

消费为日志用量乘以价格快照的**估算**，以官方账单为准。默认识别 DeepSeek 模型；其他厂商单价可自行配置。网页检索仅统计成功结算的内置调用。无法读取的会话和缺失的价格会显示提示。

余额属于当前登录的 Harness 账户，通过原生已鉴权接口读取，插件不读取或传输 API Key。源码仓库不包含个人账单、会话、凭据、日志或机器配置。费用算法与具体限制见[计费插件说明](./dsh-session-cost/README.md)。

## 仓库结构

```text
dsh-plugins/
├── dsh-session-cost/       # 用量计费 0.0.6
├── dsh-theme-atelier/      # 主题工坊 0.0.6
├── dsh-code-mode-preset/   # Code 模式 0.0.4
├── scripts/               # 统一安装、校验与打包
├── package.json
└── package-lock.json
```

授权以各插件目录的 LICENSE 为准。
