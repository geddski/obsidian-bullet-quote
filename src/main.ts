import { Plugin } from 'obsidian';
import { bulletQuoteExtension } from './live-preview';
import { renderBulletQuotes } from './reading-view';

export default class BulletQuotePlugin extends Plugin {
	onload() {
		this.registerEditorExtension(bulletQuoteExtension);
		this.registerMarkdownPostProcessor(renderBulletQuotes);
	}
}
