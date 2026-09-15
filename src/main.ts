import { Plugin } from 'obsidian';
import { bulletQuoteExtension } from './live-preview';

export default class BulletQuotePlugin extends Plugin {
	onload() {
		this.registerEditorExtension(bulletQuoteExtension);
	}
}
