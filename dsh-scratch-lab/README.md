# 试验区 · Scratch lab

把 `~/.dsh/lab` 变成随开随用的临时工作区：插件启动时自动建目录并注册成 **试验区** 工作区，侧栏新增「试验区」整页，输入一个名字即可新建 Demo 会话并直接打开。不用再为每次演示单独建工作区或 demo 目录。

## 功能

- **自动准备工作区**：首次加载时创建 `~/.dsh/lab`，并注册为 DSH 工作区；以后复用同一个工作区和目录。
- **侧栏整页**：点侧栏「试验区」图标打开页面，列出该工作区里的会话，显示标题、运行状态和更新时间。
- **命名即建会话**：输入名称点「新建并打开」，创建新会话、把名称设为会话标题、切换到对话；名称为空时自动用 `demo-YYYYMMDD-HHmm`。
- **原生能力不变**：会话仍在原生侧栏的「试验区」分组里，重命名、归档、删除、搜索、重启恢复全部沿用 DSH 行为。
- **共用目录**：所有 Demo 的 `cwd` 都是 `~/.dsh/lab`；插件不创建 demo 子目录，也不自动删除文件或会话。

## 安装

在合集仓库根目录执行：

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run check
.\scripts\install.ps1
```

只安装本插件：

```powershell
dsh plugin --profile desktop add "C:\path\dsh-plugins\dsh-scratch-lab"
```

完全退出并重新打开 Harness 后生效。插件首次启动会创建 `~/.dsh/lab` 和「试验区」工作区；已有工作区不会被修改。

## 使用

1. 点左侧栏的「试验区」图标，打开整页。
2. 在「Demo 名称」里输入名字，点「新建并打开」；留空则用时间命名。
3. 会话打开后即可像普通会话一样对话；它同时出现在原生侧栏的「试验区」分组里。
4. 在页面列表里点击任意会话可直接打开；归档后不再显示在页面列表。

## 配置

配置写在 profile 的 `cordis.patch.yml`，修改后重启 Harness 生效：

```yaml
- id: scratch-lab
  config:
    root: '~/.dsh/lab'  # 空字符串也使用这个默认值；可填绝对路径或 ~/...
    title: '试验区'      # 仅首次创建工作区时使用
```

- `root`：试验区根目录。插件会递归创建它并注册为工作区。
- `title`：首次注册的工作区标题；已有工作区不会被自动改名，页面按路径定位。

## 数据与隐私

- 插件只读写本机 `~/.dsh/lab` 和 DSH 的工作区/Session 元数据；不联网、不读取凭据、不写 `cordis.patch.yml`。
- Demo 会话和普通会话一样保存在 DSH 会话存储中；文件留在 `~/.dsh/lab`，由你自行清理。
- 不自动清理会话或目录；归档和删除使用 DSH 原生入口。

## 限制

- 所有 Demo 共用一个目录，不按 demo 建独立子目录；需要文件隔离时请自行在会话里建子目录。
- 工作区被删除后，本运行期间页面会显示「未就绪」；下次重启插件会重新创建并注册。
- 全新安装时插件会成为第一个工作区，DSH 首次默认工作区初始化会跳过；已有用户无影响。
- 当前按 DSH 0.2.2-rc.3 开发和验证；兼容下限为 0.2.2-rc.2。

## 开发

```powershell
npm.cmd run check --workspace dsh-scratch-lab
```

`client.js` 是构建产物，修改 `src/` 后运行 `npm.cmd run build --workspace dsh-scratch-lab`。测试覆盖 Host 路径与工作区准备、名称/工作区匹配/会话列表纯函数，以及客户端注册和新建流程。

当前版本 0.0.1，授权见同目录 [LICENSE](./LICENSE)。

卸载：`dsh plugin --profile desktop remove @local/scratch-lab`。卸载不会删除 `~/.dsh/lab`、工作区注册或会话记录。
