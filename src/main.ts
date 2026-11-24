import {
  App, Plugin, PluginSettingTab, Setting, Notice,
  requestUrl, normalizePath, TFolder, AbstractInputSuggest
} from 'obsidian';

interface MemosBridgeSettings {
  primaryUrl: string;
  fallbackUrl: string;
  accessToken: string;
  targetFolder: string;
  attachmentsFolder: string;
  syncDaysLimit: number;
  downloadAttachments: boolean;
  syncOnStartup: boolean;
  autoSyncInterval: number;
}

const DEFAULT_SETTINGS: MemosBridgeSettings = {
  primaryUrl: '',
  fallbackUrl: '',
  accessToken: '',
  targetFolder: 'Memos',
  attachmentsFolder: 'Attachments',
  syncDaysLimit: 30,
  downloadAttachments: true,
  syncOnStartup: true,
  autoSyncInterval: 0
};

interface MemoAttachment {
  name?: string;
  filename?: string;
}

interface MemoItem {
  name?: string;
  content?: string;
  createTime?: string | number;
  displayTime?: string | number;
  attachments?: MemoAttachment[];
  resources?: MemoAttachment[];
}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private inputEl: HTMLInputElement;
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(inputStr: string): TFolder[] {
    const lower = inputStr.toLowerCase();
    const folders: TFolder[] = [];
    this.app.vault.getAllLoadedFiles().forEach((file) => {
      if (file instanceof TFolder && file.path.toLowerCase().contains(lower)) {
        folders.push(file);
      }
    });
    return folders;
  }
  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }
  selectSuggestion(folder: TFolder): void {
    this.inputEl.value = folder.path;
    this.inputEl.trigger('input');
    this.close();
  }
}

export default class MemosBridgePlugin extends Plugin {
  settings: MemosBridgeSettings;
  private intervalId: number | null = null;

  async onload() {
    await this.loadSettings();
    this.addRibbonIcon('refresh-cw', 'Sync Memos', async () => {
      await this.syncMemos(true);
    });
    this.addCommand({
      id: 'sync-memos-now',
      name: 'Sync Memos now',
      callback: async () => {
        await this.syncMemos(true);
      }
    });
    this.addSettingTab(new MemosBridgeSettingTab(this.app, this));
    if (this.settings.syncOnStartup && this.settings.primaryUrl && this.settings.accessToken) {
      setTimeout(() => { this.syncMemos(false); }, 4000);
    }
    this.setupAutoSyncInterval();
  }

  onunload() {
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
  }

  setupAutoSyncInterval() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.settings.autoSyncInterval > 0) {
      this.intervalId = window.setInterval(() => {
        this.syncMemos(false);
      }, this.settings.autoSyncInterval * 60 * 1000);
      this.registerInterval(this.intervalId);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.setupAutoSyncInterval();
  }

  async ensureFolder(folderPath: string) {
    const normalized = normalizePath(folderPath);
    if (normalized && !this.app.vault.getAbstractFileByPath(normalized)) {
      await this.app.vault.createFolder(normalized);
    }
  }

  async fetchMemosFromServer(): Promise<{ memos: MemoItem[]; baseUrl: string }> {
    const urls = [this.settings.primaryUrl, this.settings.fallbackUrl]
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter((u) => u.length > 0);
    if (urls.length === 0 || !this.settings.accessToken.trim()) {
      throw new Error('Please configure your Memos server URL and Access Token in settings.');
    }
    const headers = {
      Authorization: `Bearer ${this.settings.accessToken.trim()}`,
      'Content-Type': 'application/json'
    };
    const apiCandidates = ['/api/memos?pageSize=200', '/api/v1/memos?pageSize=200'];
    let lastError: unknown = null;

    for (const baseUrl of urls) {
      for (const path of apiCandidates) {
        try {
          const response = await requestUrl({ url: `${baseUrl}${path}`, method: 'GET', headers });
          if (response.status >= 200 && response.status < 300 && response.json) {
            return { memos: response.json.memos || [], baseUrl };
          }
        } catch (err) {
          lastError = err;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to connect to Memos server.');
  }

  async downloadAttachment(baseUrl: string, item: MemoAttachment): Promise<string> {
    const name = item.name || '';
    const filename = item.filename || 'attachment.bin';
    const resId = name.includes('/') ? name.split('/').pop() || 'file' : 'file';
    const safeName = `memos_${resId}_${filename}`;
    const targetPath = normalizePath(`${this.settings.attachmentsFolder}/${safeName}`);

    if (this.app.vault.getAbstractFileByPath(targetPath)) return `![[${safeName}]]`;

    await this.ensureFolder(this.settings.attachmentsFolder);
    const headers = { Authorization: `Bearer ${this.settings.accessToken.trim()}` };
    const encoded = encodeURIComponent(filename);
    const candidates = [
      `${baseUrl}/file/${name}/${encoded}`,
      `${baseUrl}/api/file/${name}/${encoded}`,
      `${baseUrl}/o/r/${resId}/${encoded}`
    ];

    for (const url of candidates) {
      try {
        const res = await requestUrl({ url, method: 'GET', headers });
        if (res.status >= 200 && res.status < 300 && res.arrayBuffer) {
          await this.app.vault.createBinary(targetPath, res.arrayBuffer);
          return `![[${safeName}]]`;
        }
      } catch {
        continue;
      }
    }
    return '';
  }

  async syncMemos(manual = false) {
    if (manual) new Notice('Syncing Memos...');
    try {
      const { memos, baseUrl } = await this.fetchMemosFromServer();
      const cutoffTs = this.settings.syncDaysLimit > 0
        ? Date.now() - this.settings.syncDaysLimit * 24 * 60 * 60 * 1000
        : 0;

      const grouped: Record<string, { ts: number; text: string }[]> = {};
      let syncedCount = 0;

      for (const m of memos) {
        const rawTime = m.createTime || m.displayTime;
        if (!rawTime) continue;
        const dt = typeof rawTime === 'string' ? new Date(rawTime) : new Date(Number(rawTime) * 1000);
        if (cutoffTs > 0 && dt.getTime() < cutoffTs) continue;

        const content = (m.content || '').trim();
        const resources = m.attachments || m.resources || [];
        const attLinks: string[] = [];

        if (this.settings.downloadAttachments) {
          for (const r of resources) {
            const link = await this.downloadAttachment(baseUrl, r);
            if (link) attLinks.push(link);
          }
        }
        if (!content && attLinks.length === 0) continue;

        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        const hh = String(dt.getHours()).padStart(2, '0');
        const min = String(dt.getMinutes()).padStart(2, '0');

        const dateStr = `${yyyy}-${mm}-${dd}`;
        const timeStr = `${hh}:${min}`;
        let entry = `- **${timeStr}** ${content}`;
        if (attLinks.length > 0) entry += `\n  ${attLinks.join(' ')}`;

        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push({ ts: dt.getTime(), text: entry });
        syncedCount++;
      }

      if (syncedCount === 0) {
        if (manual) new Notice('No Memos found within the selected time range.');
        return;
      }

      await this.ensureFolder(this.settings.targetFolder);

      for (const [dateStr, items] of Object.entries(grouped)) {
        items.sort((a, b) => a.ts - b.ts);
        const filePath = normalizePath(`${this.settings.targetFolder}/${dateStr}.md`);
        const memoBlock = items.map((i) => i.text).join('\n');
        const startTag = '<!-- MEMOS-BRIDGE-START -->';
        const endTag = '<!-- MEMOS-BRIDGE-END -->';
        const wrappedBlock = `${startTag}\n${memoBlock}\n${endTag}`;

        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!existingFile) {
          await this.app.vault.create(filePath, `# ${dateStr}\n\n${wrappedBlock}\n`);
        } else {
          const oldText = await this.app.vault.read(existingFile as any);
          if (oldText.includes(startTag) && oldText.includes(endTag)) {
            const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'g');
            const newText = oldText.replace(regex, wrappedBlock);
            if (newText !== oldText) await this.app.vault.modify(existingFile as any, newText);
          } else {
            await this.app.vault.modify(existingFile as any, `${oldText.trimEnd()}\n\n${wrappedBlock}\n`);
          }
        }
      }
      if (manual) new Notice(`Memos sync complete (${syncedCount} items).`);
    } catch (err) {
      new Notice(`Memos sync failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

class MemosBridgeSettingTab extends PluginSettingTab {
  plugin: MemosBridgePlugin;
  constructor(app: App, plugin: MemosBridgePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Server connection').setHeading();
    new Setting(containerEl)
      .setName('Primary server URL')
      .setDesc('Your Memos instance URL (e.g. https://memos.example.com)')
      .addText((text) => text.setPlaceholder('https://memos.example.com')
        .setValue(this.plugin.settings.primaryUrl)
        .onChange(async (v) => { this.plugin.settings.primaryUrl = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Fallback server URL (optional)')
      .setDesc('Local or LAN URL used if primary URL is unreachable')
      .addText((text) => text.setPlaceholder('http://127.0.0.1:5230')
        .setValue(this.plugin.settings.fallbackUrl)
        .onChange(async (v) => { this.plugin.settings.fallbackUrl = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Access token')
      .setDesc('Personal Access Token generated in Memos Settings -> My Account')
      .addText((text) => {
        text.inputEl.type = 'password';
        text.setPlaceholder('memos_pat_...')
          .setValue(this.plugin.settings.accessToken)
          .onChange(async (v) => { this.plugin.settings.accessToken = v; await this.plugin.saveSettings(); });
      });

    new Setting(containerEl).setName('Storage & folders').setHeading();
    new Setting(containerEl)
      .setName('Target notes folder')
      .setDesc('Folder where daily Memos markdown files will be saved')
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text.setPlaceholder('Memos').setValue(this.plugin.settings.targetFolder)
          .onChange(async (v) => { this.plugin.settings.targetFolder = v; await this.plugin.saveSettings(); });
      });

    new Setting(containerEl)
      .setName('Attachments folder')
      .setDesc('Folder where downloaded images and files will be stored')
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text.setPlaceholder('Attachments').setValue(this.plugin.settings.attachmentsFolder)
          .onChange(async (v) => { this.plugin.settings.attachmentsFolder = v; await this.plugin.saveSettings(); });
      });

    new Setting(containerEl)
      .setName('Download attachments')
      .setDesc('Automatically download images/files into your vault and link them')
      .addToggle((t) => t.setValue(this.plugin.settings.downloadAttachments)
        .onChange(async (v) => { this.plugin.settings.downloadAttachments = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName('Sync behavior').setHeading();
    new Setting(containerEl)
      .setName('Sync days limit')
      .setDesc('Only sync Memos created within the last N days (0 = sync all)')
      .addText((text) => text.setPlaceholder('30').setValue(String(this.plugin.settings.syncDaysLimit))
        .onChange(async (v) => {
          const p = parseInt(v, 10);
          this.plugin.settings.syncDaysLimit = isNaN(p) || p < 0 ? 0 : p;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Sync on startup')
      .setDesc('Automatically sync Memos 4 seconds after Obsidian opens')
      .addToggle((t) => t.setValue(this.plugin.settings.syncOnStartup)
        .onChange(async (v) => { this.plugin.settings.syncOnStartup = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Background sync interval (minutes)')
      .setDesc('Set to 0 to disable periodic background sync')
      .addText((text) => text.setPlaceholder('0').setValue(String(this.plugin.settings.autoSyncInterval))
        .onChange(async (v) => {
          const p = parseInt(v, 10);
          this.plugin.settings.autoSyncInterval = isNaN(p) || p < 0 ? 0 : p;
          await this.plugin.saveSettings();
        }));
  }
}
