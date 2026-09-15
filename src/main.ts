import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, BulletQuoteSettingTab } from './settings';
import type { BulletQuoteSettings } from './settings';

export default class BulletQuotePlugin extends Plugin {
	settings!: BulletQuoteSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new BulletQuoteSettingTab(this.app, this));

		// command ids and names must not repeat the plugin id/name; obsidian prefixes them
		this.addCommand({
			id: 'greet',
			name: 'Greet',
			callback: () => {
				new Notice(this.settings.greeting);
			},
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<BulletQuoteSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
