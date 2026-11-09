# DSH 插件 · DeepSeek Harness Plugins

DeepSeek Harness 的四个插件，一个仓库统一维护。四个插件独立升版：用量计费为 **0.0.6**，主题工坊为 **0.0.6**，Code 模式为 **0.0.4**，每日待办为 **0.0.1**。

| 插件 | 目录 | 功能 |
| --- | --- | --- |
| 用量计费 | [dsh-session-cost](./dsh-session-cost) | 范围化消费主数字、账户余额、逐模型可展开明细、分时/每日趋势、输入框计费浮层、CSV、自定义单价 |
| 主题工坊 | [dsh-theme-atelier](./dsh-theme-atelier) | 六套参考成熟设计系统的明暗配色 + DSH 原生、当前方案预览、原生明暗同步与持久化 |
| Code 模式 | [dsh-code-mode-preset](./dsh-code-mode-preset) | 直接实施、Git 纪律与工作树、持久终端、先读后写保护、运行项目检查的编码预设 |
| 每日待办 | [dsh-todo-widget](./dsh-todo-widget) | 侧边栏整页按天记待办、输入框下方进度快捷条、完成时间、到点与收尾提醒 |

## 安装

需要 Node.js 20+、npm，以及已安装的 DeepSeek Harness。当前适配 Harness **0.2.2-rc.1**。

```powershell
git clone https://github.com/Miaoge-Ge/dsh-plugins.git
cd dsh-plugins
npm.cmd ci --ignore-scripts
npm.cmd run check
.\scripts\install.ps1
```

安装脚本将四个插件链接到当前源码目录。完全退出并重新打开 Harness 后生效。不要移动或删除源码目录；迁移后重新执行安装脚本即可更新引用。Web 配置可使用 `.\scripts\install.ps1 -Profile web`。

也可只安装其中一个插件：

```powershell
dsh plugin --profile desktop add "C:\path\dsh-plugins\dsh-todo-widget"
```

**使用入口**：账号菜单 → 设置 →「用量计费」「主题工坊」；新建会话的 Agent 预设中选择「Code 模式」；「每日待办」在侧边栏打开整页，输入框下方还有一条进度快捷条。计费工具也提供输入框下方入口。

## 开发与打包

仓库根目录统一管理 npm workspaces 与锁文件，不包含嵌套 Git 仓库。

```powershell
npm.cmd run build         # 构建三个客户端插件
npm.cmd test              # 运行计量、余额、主题与待办测试
npm.cmd run check         # 元数据/YAML 校验、构建、语法检查与测试
npm.cmd run pack:plugins  # 在 dist/ 生成三个安装包
```

`client.js`、`catalog.js` 是构建产物，修改对应 `src/` 后重新构建。修改后需重新加载 Harness。仓库的 `private: true` 仅防止误发布到 npm；GitHub 仓库是公开的。

## 可选技能（Agent Skills）

`skills/` 收录了从 [anthropics/skills](https://github.com/anthropics/skills) 适配并本地化的技能；它们不随插件包安装，由 DSH 的技能目录提供：

- `frontend-design`：前端视觉方向、字体与版式指导。
- `mcp-builder`：构建 Python / Node MCP 服务器，并附通过 DSH Cordis bundle 接入的说明。
- `canvas-design`：海报与艺术类 PNG / PDF 输出，附带 OFL 字体。

安装或同步到当前用户的 DSH 技能目录（`~/.agents/skills`，或 `$DSH_AGENTS_HOME/skills`）：

```powershell
git pull
.\scripts\install-skills.ps1
# 只放到本仓库的 .agents/skills（仅以本仓库为项目根目录的会话可见）
.\scripts\install-skills.ps1 -Project
# 覆盖同名技能
.\scripts\install-skills.ps1 -Force
```

POSIX 使用 `./scripts/install-skills.sh [--project] [--force]`。默认跳过已存在的同名技能；DSH 会扫描并 watch 这些目录，同步后新会话即可看到。技能来源、Apache-2.0 / OFL 许可与本地改动见各目录的 `ATTRIBUTION.md` 与 `LICENSE.txt`。

## 计费与隐私

消费为日志用量乘以价格快照的**估算**，以官方账单为准。默认识别 DeepSeek 模型；其他厂商单价可自行配置。网页检索仅统计成功结算的内置调用。无法读取的会话和缺失的价格会显示提示。

余额属于当前登录的 Harness 账户，通过原生已鉴权接口读取，插件不读取或传输 API Key。源码仓库不包含个人账单、会话、凭据、日志或机器配置。费用算法与具体限制见[计费插件说明](./dsh-session-cost/README.md)。

「每日待办」的待办只保存在本机浏览器存储（按天、最多 400 天），不读取会话、不写入配置、不上传网络；清除站点数据会同时清除待办。

## 仓库结构

```text
dsh-plugins/
├── dsh-session-cost/       # 用量计费 0.0.6
├── dsh-theme-atelier/      # 主题工坊 0.0.6
├── dsh-code-mode-preset/   # Code 模式 0.0.4
├── dsh-todo-widget/        # 每日待办 0.0.1
├── skills/                 # 可选 Agent Skills（非插件）
├── scripts/                # 插件与技能的安装、校验与打包
├── package.json
└── package-lock.json
```

授权以各插件目录的 LICENSE 为准。
