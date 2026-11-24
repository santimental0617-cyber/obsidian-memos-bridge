# Obsidian Memos Bridge

Sync your self-hosted Memos into Obsidian effortlessly. Supports the latest `/api/memos` REST API as well as legacy `/api/v1/memos`.

## Features
- **Latest API Support**: Works out-of-the-box with modern Memos releases where `/api/v1` was removed.
- **Dual-URL Fallback**: Configure both a public domain URL and a local/LAN fallback URL.
- **Non-Destructive Updates**: Uses `<!-- MEMOS-BRIDGE-START -->` and `<!-- MEMOS-BRIDGE-END -->` markers so manual notes in the same file are preserved.
- **Attachment Auto-Download**: Downloads attached images into your Obsidian attachments folder and embeds them as `![[filename]]`.
- **Native Folder Picker**: Built-in vault folder autocomplete in settings.
