# 主题工坊 · Atelier

为 DeepSeek Harness 设计的原生主题插件。六种设计语言，每套提供浅色与深色两版；兼容原生“跟随系统”。

| 主题 | 风格 | 设计特点 |
| --- | --- | --- |
| 曜石 Obsidian | 静奢、精密 | 石墨灰、香槟金、克制圆角 |
| 纸间 Paper | 编辑、人文 | 暖纸色、墨色、衬线标题、小圆角 |
| 极光 Aurora | 通透、数字 | 雾蓝与鸢尾紫、柔和层次、较大圆角 |
| 青瓷 Celadon | 东方、自然 | 青瓷绿、温润石色、柔和轮廓、衬线标题 |
| 构成 Bauhaus | 几何、现代 | 清晰直角、克制红色、高对比 |
| 终端 Terminal | 理性、复古 | 墨绿与荧光绿、紧致几何轮廓 |

## 0.0.1 外观

去掉画廊式大封面与样张预览，改成与设置页其余部分一致的紧凑选择器：每套设计一张卡片，色带直接取自该主题在当前明暗方案下的 bg / sidebar / surface / accent。点击卡片立即应用，已应用的卡片带描边与「已应用」标记。

## 使用

打开 **账号菜单 → 设置 → 主题工坊**。点击主题卡片立即应用；「恢复原生主题」回到内置外观。

- **明暗模式**：直接使用原生 `ui-theme` 设置，与通用设置保持同步。
- **设计细节**：开启主题圆角与部分主题的 Markdown 一级、二级标题字体。关闭后只应用配色。
- **恢复原生主题**：移除本插件的令牌图层，保留其他插件的图层。
- 设置由 Harness Host 保存，刷新和重启后恢复；拒绝写入时界面显示失败，不虚报保存成功。
- 代码字体、用户字体、字号、状态色、diff 色与语法高亮沿用原生设计系统。

## 安装

已构建的压缩包可在 Harness 插件管理中按本地包安装，也可以使用官方 CLI：

```powershell
dsh plugin --profile desktop add "C:\path\local-dsh-theme-atelier-0.0.1.tgz"
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

1. 复制 `themes/01-obsidian.json`，改成新的文件名、唯一 `id`、中英文名称与说明。
2. 修改 `light` / `dark` 两组颜色。每组只需 11 个六位十六进制颜色：`bg`、`sidebar`、`surface`、`raised`、`text`、`muted`、`accent`、`onAccent`、`line`、`soft`、`code`。
3. `radii` 的六个整数依次对应 xs、sm、md、lg、xl、panel 圆角，范围 0–40。
4. `design` 选择 `minimal`、`editorial`、`glass`、`organic`、`geometric`、`terminal`，决定主题分类和可选标题风格。
5. 运行 `npm.cmd run check`，重启 Harness。目录中的 JSON 会自动进入主题列表和 Host 设置枚举，无需修改页面代码。

构建会检查唯一 ID、配色完整性、数据类型，以及正文、次要文字、强调文字在六种主要背景上的 4.5:1 对比度。新增主题未通过检查时不会覆盖已有构建文件。

## 结构与兼容性

- `themes/*.json`：主题数据。
- `src/tokens.mjs`：纯函数令牌编译、验证与生命周期逻辑。
- `src/client.js`：React 设置页，走原生 `settings.section` 扩展点。
- `src/style.css`：仅作用于 `at-` 前缀的插件组件。
- `scripts/build.mjs`：零构建依赖，将主题、字典、CSS 编译到原生 ModuleLoader 格式。
- `index.js`：Host 的 volatile 设置 schema。
- `test/*.test.mjs`：对比度、数据校验、恢复、图层隔离与资源检查。

依赖公开的 `theme.overrideTokens`、`configForms`、`slots`、`locale` 服务。React 使用 Harness 已有实例，无 CDN、外部字体、图像请求或重复 React。主题按语义令牌覆盖，不查找宿主内部类名，不修改原生安装文件。弹层保留不透明底色作为兼容策略；“通透”风格不依赖模糊滤镜。错误、成功、警告、diff 与语法高亮继续由宿主按明暗模式管理。

适配依据是本机 **DeepSeek Harness 0.2.2-rc.1 / Windows** 的真实运行时。更早版本缺少 `overrideTokens` 时显示兼容提示。未来 API 仍可能变化，其他操作系统和第三方插件组合尚未逐一验证。第三方主题在插件启动后应用，首屏可能短暂显示原生配色。

已验证：12 套配色实际切换、持久化、页面刷新、原生模式同步、恢复原生、设计细节开关、窄屏单列且无横向溢出、插件禁用清理样式与令牌、重新启用。测试环境控制台未发现插件错误。

参考：[官方主题接口](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-theme/README.md)、[官方设置接口](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings/README.md)。安装包内附原生格式的中英文插件信息及原创图标。

## 验证

在真实 Harness 0.2.2-rc.1 Web 宿主验证：主题卡片应用、应用后重新加载仍保持、原生明暗切换、恢复原生、390px 窄窗口无横向溢出、页面无 JavaScript 错误。`npm.cmd run check` 包含 6 项主题与生命周期测试。
