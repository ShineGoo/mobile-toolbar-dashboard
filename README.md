# Mobile Toolbar Dashboard

A floating command dashboard for Obsidian Mobile. Drag the handle, organize commands, and use a vertical or horizontal scrolling panel.

Obsidian 移动端悬浮命令面板，支持拖动吸附、命令管理及横向、竖向滚动布局。

Author / 作者：[ShineGoo](https://github.com/ShineGoo)

## English

### Features

- Tap to expand or collapse; long-press and drag to reposition.
- Vertical and horizontal scrolling layouts with adjustable dimensions and spacing.
- Add, remove, reorder, and assign icons to registered Obsidian commands.
- Optional reuse of Commander icon mappings when available.
- Collapsible settings and configurable collapse behavior.
- Position recovery, configuration export/import, and scoped resets.

### Language packages

| Package | Plugin interface |
| --- | --- |
| `Mobile-Toolbar-Dashboard-3.2.1-en.zip` | English |
| `Mobile-Toolbar-Dashboard-3.2.1-zh-CN.zip` | Simplified Chinese |

Both packages display the name **Mobile Toolbar Dashboard** and use the same plugin ID, `mobile-toolbar-dashboard`. Install only one package. To switch languages, disable the plugin and replace its three program files, keeping `data.json`.

The English package translates all text supplied by this plugin. Command names provided by Obsidian or other plugins retain their original language. System-generated error details may also follow the system language.

For a single Community directory entry, publish one default language as the standard `main.js`, `styles.css`, and `manifest.json` release attachments. The ZIP packages can be additional downloads. Automatic updates use those standard attachments and may replace a manually installed language variant.

### Installation

1. Extract the chosen ZIP.
2. Copy the `mobile-toolbar-dashboard` folder into `<vault>/<config-directory>/plugins/`. The default configuration directory is `.obsidian`.
3. When updating, disable the plugin first, back up its folder, and replace `main.js`, `styles.css`, and `manifest.json`. Keep `data.json`.
4. Enable **Mobile Toolbar Dashboard** in Obsidian's community plugin settings.

The floating interface is mobile-only. The manifest currently declares Obsidian `1.13.0` as the minimum version; a complete device and version compatibility matrix is not available.

### Usage

- Tap the handle to expand or collapse the panel.
- Hold the handle for 350 ms, then drag. Hold a command for 600 ms to show its name. Both durations are adjustable.
- Use **Vertical position** to move the handle directly. Safety margins define excluded areas rather than a target position.
- Use **Recover now** at the top of settings if the handle is misplaced.
- Disabling position memory does not disable dragging; defaults apply on the next load.

| Reset | Scope |
| --- | --- |
| Recover handle | Position, docking, and safety margins; collapses the panel |
| Reset layout | Layout, appearance, and position |
| Reset behavior | Collapse behavior, position, and gestures |
| Restore all default settings | All settings; preserves command order and custom icons |
| Factory reset | All configuration; reloads the current Obsidian mobile toolbar command list |

### Storage and integration

The plugin uses the active Obsidian vault, with no hard-coded device storage path. Obsidian manages the plugin's `data.json`. Exported configuration defaults to the vault-relative folder `MobileCommandCenter/backup`. The plugin does not install itself into a vault.

The native mobile toolbar is hidden while the dashboard is successfully initialized. Unloading removes that hiding state. Commands and icons provided by other plugins depend on those plugins being available.

### Feedback

Include the plugin version, Obsidian version, device/OS, reproduction steps, and expected versus actual behavior. For display issues, include relevant theme and CSS snippet details. Remove private data before sharing configurations or screenshots.

## 中文

### 功能

- 点击展开或收起，长按后拖动，支持左右吸附。
- 横向与竖向滚动布局，可调整尺寸、行列数和间距。
- 添加、删除、排序 Obsidian 已注册命令，设置自定义图标。
- 可选复用 Commander 的图标映射。
- 折叠设置分组，可配置自动收起行为。
- 位置救援、配置导入导出及分范围恢复。

### 语言版本

`Mobile-Toolbar-Dashboard-3.2.1-en.zip` 提供英文界面；`Mobile-Toolbar-Dashboard-3.2.1-zh-CN.zip` 提供简体中文界面。两版均显示英文插件名 **Mobile Toolbar Dashboard**。

两版共用插件 ID `mobile-toolbar-dashboard`，请选择其中一个安装。切换语言时关闭插件，替换三个程序文件，并保留 `data.json`。

英文包翻译本插件提供的全部界面文字；Obsidian 和其他插件提供的命令名称仍遵循它们各自的语言，系统错误详情也可能使用系统语言。

社区目录中的一个插件条目使用一套默认发布附件。可以把两种 ZIP 作为额外下载，但自动更新使用的是标准附件，因此可能覆盖手动安装的语言版本。

### 安装

1. 解压所选语言的 ZIP。
2. 将 `mobile-toolbar-dashboard` 文件夹放入 `<仓库>/<配置目录>/plugins/`，默认配置目录为 `.obsidian`。
3. 升级前先关闭插件并备份原文件夹，再替换 `main.js`、`styles.css`、`manifest.json`，保留 `data.json`。
4. 在第三方插件设置中启用 **Mobile Toolbar Dashboard**。

悬浮界面仅在移动端显示。当前 manifest 声明的最低 Obsidian 版本为 `1.13.0`，尚无完整设备及版本兼容矩阵。

### 使用

- 点击悬浮按钮展开或收起。
- 默认长按按钮 350 ms 后拖动；长按命令 600 ms 显示名称，时长均可调整。
- “垂直位置”直接移动按钮；顶部与底部安全距离定义禁入区域，不是目标位置。
- 找不到按钮时，点击设置顶部的“立即救援”。
- 关闭位置记忆不会禁止当次拖动，只影响下次加载时的位置。

| 恢复操作 | 范围 |
| --- | --- |
| 立即救援 | 位置、吸附方式和安全距离，并收起面板 |
| 恢复布局 | 布局、外观和位置 |
| 恢复行为 | 展开/收起行为、位置和手势 |
| 恢复稳定默认值 | 全部设置，保留命令顺序及自定义图标 |
| 完全恢复出厂设置 | 全部配置，重新读取当前 Obsidian 移动工具栏命令 |

### 存储与集成

插件通过 Obsidian 访问当前仓库，不绑定任何设备的绝对存储路径。`data.json` 由 Obsidian 管理；导出配置默认保存到当前仓库下的 `MobileCommandCenter/backup`。插件不会自行安装到其他仓库。

仪表盘成功初始化后隐藏原生移动工具栏，卸载时移除隐藏状态。其他插件提供的命令和图标依赖对应插件可用。

### 反馈

请提供插件版本、Obsidian 版本、设备与系统、复现步骤、预期结果和实际结果。界面问题请补充主题与 CSS snippet 信息，分享配置或截图前移除私人数据。
