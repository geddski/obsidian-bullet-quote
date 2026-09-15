import { PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';

export interface BulletQuoteSettings {
	greeting: string;
}

export const DEFAULT_SETTINGS: BulletQuoteSettings = {
	greeting: 'Hello',
};

// declarative tab (obsidian 1.13+): obsidian reads and persists
// `plugin.settings` by key, and the entries show up in settings search.
export class BulletQuoteSettingTab extends PluginSettingTab {
	getSettingDefinitions(): SettingDefinitionItem<keyof BulletQuoteSettings>[] {
		return [
			{
				name: 'Greeting',
				desc: 'Shown by the example command.',
				control: { type: 'text', key: 'greeting', placeholder: DEFAULT_SETTINGS.greeting },
			},
		];
	}
}
