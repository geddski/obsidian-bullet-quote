import { syntaxTree } from '@codemirror/language';
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { editorLivePreviewField } from 'obsidian';

// a list marker (bullet, number, or task box) whose content opens with a quote
// marker. obsidian's parser leaves this shape as plain text.
const QUOTE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[^\]]\]\s+)?(>)(\s+|$)/;

// an indented quote line. obsidian renders it, but puts the bar at the left
// margin instead of under the list item it belongs to.
const QUOTE_CONT = /^(\s+)(>)(\s?)/;

// token names obsidian's stream parser gives text that only looks like markdown
const NOT_MARKDOWN = /codeblock|comment|math|frontmatter/;

// zero-width anchor for the bar; the css draws it at line height from here
class BarWidget extends WidgetType {
	toDOM() {
		return createSpan({ cls: 'bullet-quote-bar' });
	}
	eq() {
		return true;
	}
	ignoreEvent() {
		return true;
	}
}
const bar = new BarWidget();

const barInsteadOfMarker = Decoration.replace({ widget: bar });
const barBeforeMarker = Decoration.widget({ widget: bar, side: -1 });
const shownMarker = Decoration.mark({ class: 'cm-formatting cm-formatting-quote bullet-quote-marker' });
const quoteText = Decoration.mark({ class: 'cm-quote bullet-quote-text' });
// on the active line the visible `> ` supplies the gap after the bar, so the
// text carries no padding there; otherwise the cursor at the text's start
// would sit a padding's width left of the first character
const activeQuoteText = Decoration.mark({ class: 'cm-quote bullet-quote-text bullet-quote-active' });
const inListQuoteLine = Decoration.line({ class: 'bullet-quote-cont' });

function buildDecorations(view: EditorView): DecorationSet {
	if (!view.state.field(editorLivePreviewField)) {
		return Decoration.none;
	}
	const ranges: Range<Decoration>[] = [];
	const { doc, selection } = view.state;
	const tree = syntaxTree(view.state);
	for (const { from, to } of view.visibleRanges) {
		let pos = from;
		while (pos <= to) {
			const line = doc.lineAt(pos);
			pos = line.to + 1;
			let markerFrom: number;
			let textFrom: number;
			const item = QUOTE_ITEM.exec(line.text);
			const cont = item ? null : QUOTE_CONT.exec(line.text);
			if (item) {
				textFrom = line.from + item[0].length;
				markerFrom = textFrom - (item[1]?.length ?? 0) - (item[2]?.length ?? 0);
			} else if (cont) {
				markerFrom = line.from + (cont[1]?.length ?? 0);
				textFrom = line.from + cont[0].length;
			} else {
				continue;
			}
			const token = tree.resolveInner(markerFrom, 1).name;
			if (NOT_MARKDOWN.test(token)) {
				continue;
			}
			if (cont) {
				// only quotes the parser placed inside a list item; a plain
				// indented quote elsewhere keeps obsidian's rendering
				if (!/formatting-quote/.test(token) || !/list-\d/.test(token)) {
					continue;
				}
				ranges.push(inListQuoteLine.range(line.from));
			}
			const isActive = selection.ranges.some((r) => r.from <= line.to && r.to >= line.from);
			if (isActive) {
				ranges.push(barBeforeMarker.range(markerFrom));
				ranges.push(shownMarker.range(markerFrom, textFrom));
			} else {
				ranges.push(barInsteadOfMarker.range(markerFrom, textFrom));
			}
			if (textFrom < line.to) {
				ranges.push((isActive ? activeQuoteText : quoteText).range(textFrom, line.to));
			}
		}
	}
	return Decoration.set(ranges, true);
}

export const bulletQuoteExtension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			const modeChanged =
				update.state.field(editorLivePreviewField) !== update.startState.field(editorLivePreviewField);
			// the parser can finish after the edit that triggered it, in a
			// transaction with no other change
			const treeChanged = syntaxTree(update.state) !== syntaxTree(update.startState);
			if (update.docChanged || update.viewportChanged || update.selectionSet || modeChanged || treeChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);
