# 主题工坊 · Atelier

为 DeepSeek Harness 设计的原生主题插件。十套自有风格名，每套提供浅色与深色两版；另加 DSH 原生主题作为同组可选项，兼容原生“跟随系统”。

前六套参考成熟产品与编辑器社区长期验证过的设计系统：Claude 的暖纸与陶土橙、GitHub 的中性灰与清晰蓝、Nord 的极地蓝灰、Solarized 的米色与深青、VS Code Modern 的灰阶、One Dark 的炭灰。借用的是它们的色阶关系、单一强调色与层级秩序；所有色值重新做过对比度校验，不是官方主题，也没有复制其资源。界面只显示自有风格名，参考对象只出现在说明文档里。

| 主题 | 设计参考 | 说明 |
| --- | --- | --- |
| 石墨蓝 Graphite Blue | GitHub | 中性灰、清晰蓝、干净边界 |
| 暖纸 Warm Paper | Claude | 暖纸、陶土橙、衬线标题 |
| 霜蓝 Frost Blue | Nord | 极地蓝灰与霜青 |
| 海盐青 Sea Glass | Solarized | 米色、青瓷与深青 |
| 中性灰 Neutral Gray | VS Code Modern | 克制的灰阶与单一蓝 |
| 炭灰蓝 Charcoal Blue | One Dark | 炭灰底与开发者蓝 |
| 苔绿 Moss Green | 自然工作室 | 自然绿、柔和圆角与衬线标题 |
| 暮紫 Twilight Violet | 现代工作室 | 低饱和紫、紧凑轮廓与清晰边界 |
| 玫瑰灰 Rose Gray | 柔和对话 | 大圆角、暖灰与柔和表面 |
| 琥珀棕 Amber Brown | 经典书房 | 暖纸色、细圆角与衬线标题 |
| DSH 原生 | DeepSeek Harness | 内置外观，不叠加任何主题图层 |

## 外观

设置页以工作区缩略预览展示主题的侧栏、对话、代码块和输入框，便于比较文字与表面层次。主题名称位于预览下方，已应用的主题带描边和勾选标记；窄内容区自动调整列数。预览随当前明暗模式更新，明暗模式和设计细节仍使用原生设置控件。

## 使用

打开 **账号菜单 → 设置 → 主题工坊**。点击任意主题卡片（包括 DSH 原生）立即应用；选择 DSH 原生即移除本插件的令牌图层，回到内置外观。

- **明暗模式**：直接使用原生 `ui-theme` 设置，与通用设置保持同步。
- **设计细节**：开启主题圆角与部分主题的 Markdown 标题衬线字体。关闭后只应用配色。
- 设置由 Harness Host 保存，刷新和重启后恢复；拒绝写入时界面显示失败，不虚报保存成功。
- 代码字体、用户字体、字号、状态色、diff 色与语法高亮沿用原生设计系统。

## 安装

已构建的压缩包可在 Harness 插件管理中按本地包安装，也可以使用官方 CLI：

```powershell
dsh plugin --profile desktop add "C:\path\local-dsh-theme-atelier-0.0.8.tgz"
```

Web 版把 `desktop` 换成 `web`。若使用源码目录链接安装：

```powershell
cd C:\path\dsh-plugins
npm.cmd ci --ignore-scripts
npm.cmd run check
dsh plugin --profile desktop add "C:\path\dsh-plugins\dsh-theme-atelier"
```

命令行安装后，完全退出再打开 Harness，以载入新模块。链接安装需要保留源码目录；移动目录后需通过插件管理重新安装。

可在插件管理中禁用、卸载本插件；也可运行 `dsh plugin --profile desktop remove @local/dsh-theme-atelier`。卸载不会更改原生明暗偏好和字体配置。

## 新增主题

1. 复制 `themes/01-obsidian.json`，改成新的文件名、唯一 `id` 与中英文名称。名称就是卡片上显示的主题风格名，不需要再写说明或描述。
2. 修改 `light` / `dark` 两组颜色。每组只需 11 个六位十六进制颜色：`bg`、`sidebar`、`surface`、`raised`、`text`、`muted`、`accent`、`onAccent`、`line`、`soft`、`code`。
3. `radii` 的六个整数依次对应 xs、sm、md、lg、xl、panel 圆角，范围 0–40。
4. `design` 选择 `minimal`、`editorial`、`glass`、`organic`、`geometric`、`terminal`、`botanical`、`studio`、`soft`、`classic`；`editorial`、`organic`、`botanical` 与 `classic` 会为 Markdown 一至三级标题启用衬线字体。
5. 运行 `npm.cmd run check`，重启 Harness。目录中的 JSON 会自动进入主题列表和 Host 设置枚举，无需修改页面代码。

构建会检查唯一 ID、配色完整性、数据类型，以及正文、次要文字、强调文字在六种主要背景上的 4.5:1 对比度。新增主题未通过检查时不会覆盖已有构建文件。

## 设计参考与边界

- 参考对象是公开的设计语言与配色思路，不是官方主题包；相关名称与商标归各自所有者，本插件与这些产品没有隶属关系。
- 只借用中性色阶、强调色与表面层级，所有颜色都在本插件内重新取值并校验，不引入对方的字体、图标、样式表或截图。
- 强调色同时承担链接与主按钮，因此深色模式的强调色会比原主题更亮、浅色模式会比原主题更深；这是为了同时满足“文字可读”和“按钮文字可读”。
- 错误、成功、警告、diff 与语法高亮仍由 Harness 原生设计系统管理，避免主题越权改变语义色。

## 结构与兼容性

- `themes/*.json`：主题数据。
- `src/tokens.mjs`：纯函数令牌编译、派生色、验证与生命周期逻辑。
- `src/client.js`：React 设置页，走原生 `settings.section` 扩展点。
- `src/style.css`：仅作用于 `at-` 前缀的插件组件。
- `scripts/build.mjs`：零构建依赖，将主题、字典、CSS 编译到原生 ModuleLoader 格式。
- `index.js`：Host 的 volatile 设置 schema。
- `test/*.test.mjs`：对比度、数据校验、恢复、图层隔离与资源检查。

依赖公开的 `theme.overrideTokens`、`configForms`、`slots`、`locale` 服务。React 使用 Harness 已有实例，无 CDN、外部字体、图像请求或重复 React。主题按语义令牌覆盖，不查找宿主内部类名，不修改原生安装文件。弹层保留不透明底色作为兼容策略；“通透”风格不依赖模糊滤镜。

强调色的悬停、选中底色、代码块标题栏与侧栏选中态由 `src/tokens.mjs` 从主题的强调色派生，主题文件本身仍只保存 11 个基础颜色。DSH 0.2.2-rc.2 新增的卡片、悬停卡、通知动作、上传轨道与侧栏玻璃/渐变表面也纳入覆盖；0.2.2-rc.3 的主题样式表与令牌定义相对 rc.2 没有增删，这些表面仍然全部覆盖。图表、JSON 树与成败状态色仍有意沿用宿主原生值。

适配依据是本机 **DeepSeek Harness 0.2.2-rc.3 / Windows** 的真实运行时（兼容下限 0.2.2-rc.2）。更早版本缺少 `overrideTokens` 时显示兼容提示。未来 API 仍可能变化，其他操作系统和第三方插件组合尚未逐一验证。第三方主题在插件启动后应用，首屏可能短暂显示原生配色。

## 验证

`npm.cmd run check` 会构建十套主题、检查 20 套配色在六种背景上的文字对比度与强调按钮文字对比度，并运行 11 项主题、生命周期与资源测试。测试另确认派生悬停色与强调色可区分、边框为六位十六进制、rc.2 起引入的表面令牌在 rc.3 仍然齐全，以及衬线标题令牌重写了 Markdown 标题实际使用的 `font` 简写。

设置页的视觉与交互仍建议在真实页面中复核：切换明暗、应用每套主题、刷新后恢复、恢复原生、窄屏单列。当前仓库的自动化测试不包含浏览器截图，视觉结论以运行中的 Harness 页面为准。
