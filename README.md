# Obsidian Memos Bridge

[中文说明](#中文说明) | [English](#english)

---

## 中文说明

**Memos Bridge** 是一款专为自托管 [Memos](https://github.com/usememos/memos) 打造的 Obsidian 同步插件，完美适配已移除 `/api/v1` 的最新版 Memos 接口（`/api/memos`），同时向下兼容旧版 `/api/v1/memos`。

### 核心特性
- **兼容最新接口**：开箱即用支持最新版 Memos（`26.x+`），解决旧版同步插件报 `HTTP 410 Gone` 的问题。
- **公网/内网双地址自动回退**：支持同时配置主服务器地址（如公网域名）与备用本地地址（如 `http://127.0.0.1:5230`），主地址不可达时自动无缝切换。
- **无损局部增量更新**：通过 `<!-- MEMOS-BRIDGE-START -->` 与 `<!-- MEMOS-BRIDGE-END -->` 标记精准更新每日同步区块，**绝不覆盖**你在同一篇笔记中手写的批注与总结。
- **附件自动下载与内嵌**：自动抓取 Memo 中的图片与附件保存到指定的 Obsidian 附件目录，并自动转换为 `![[文件名]]` 双链格式。
- **原生文件夹补全**：设置面板内置 Obsidian 原生文件夹模糊搜索下拉框，配置路径直观准确。

### 安装方式

#### 方式一：通过 BRAT 插件安装（推荐）
1. 在 Obsidian 第三方插件市场搜索并安装 **BRAT**。
2. 打开 BRAT 设置，点击 **Add Beta Plugin**，输入本仓库地址：`https://github.com/santimental0617-cyber/obsidian-memos-bridge`。
3. 在第三方插件列表中启用 **Memos Bridge**，填入你的服务器地址与 Access Token 即可。

#### 方式二：手动安装
1. 前往本仓库右侧的 [Releases](https://github.com/santimental0617-cyber/obsidian-memos-bridge/releases) 页面，下载最新版本的 `main.js` 和 `manifest.json`。
2. 在你的 Obsidian 仓库目录下新建文件夹：`<你的仓库>/.obsidian/plugins/memos-bridge/`，将上述两个文件放入其中。
3. 重启或重载 Obsidian，在 **设置 -> 第三方插件** 中开启 **Memos Bridge**。

---

## English

**Memos Bridge** syncs your self-hosted [Memos](https://github.com/usememos/memos) into Obsidian effortlessly. Built specifically to support the latest Memos REST API (`/api/memos`) where `/api/v1` has been removed, while maintaining backward compatibility with legacy `/api/v1/memos`.

### Features
- **Latest API Support**: Works out-of-the-box with modern Memos releases (`26.x+`), fixing the `HTTP 410 Gone` error found in unmaintained plugins.
- **Dual-URL Fallback**: Configure both a primary public URL and a local/LAN fallback URL for seamless switching across networks.
- **Non-Destructive Partial Updates**: Uses `<!-- MEMOS-BRIDGE-START -->` and `<!-- MEMOS-BRIDGE-END -->` markers so your manual notes and annotations in the same daily file are never overwritten.
- **Attachment Auto-Download**: Automatically downloads attached images/files into your Obsidian attachments folder and embeds them as `![[filename]]`.
- **Native Folder Picker**: Built-in vault folder autocomplete in plugin settings.

### Installation

#### Via BRAT (Recommended)
1. Install the **BRAT** plugin from Obsidian Community Plugins.
2. Click **Add Beta Plugin** and enter `https://github.com/santimental0617-cyber/obsidian-memos-bridge`.
3. Enable **Memos Bridge** in Community Plugins and configure your server URL and Access Token.

#### Manual Installation
1. Download `main.js` and `manifest.json` from the latest [Releases](https://github.com/santimental0617-cyber/obsidian-memos-bridge/releases).
2. Place them into `<YourVault>/.obsidian/plugins/memos-bridge/`.
3. Reload Obsidian and enable **Memos Bridge**.
