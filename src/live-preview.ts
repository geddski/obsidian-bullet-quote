import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';

// a list marker (bullet, number, or task box) whose content opens with a quote
// marker. obsidian's parser leaves this shape as plain text.
const QUOTE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[^\]]\]\s+)?(>)(\s+|$)/;

// an indented quote line. obsidian renders it, but puts the bar at the left
// margin instead of under the list item it belongs to.
const QUOTE_CONT = /^(\s+)(>)(\s?)/;

// token names obsidian's stream parser gives text that only looks like markdown
const NOT_MARKDOWN = /codeblock|comment|math|frontmatter/;

const hiddenMarker = Decoration.replace({});
const shownMarker = Decoration.mark({ class: 'cm-formatting cm-formatting-quote bullet-quote-marker' });
const quoteText = Decoration.mark({ class: 'cm-quote bullet-quote-text' });
const inListQuoteLine = Decoration.line({ class: 'bullet-quote-cont' });

function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	if (!view.state.field(editorLivePreviewField)) {
		return builder.finish();
	}
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
				builder.add(line.from, line.from, inListQuoteLine);
			}
			// the marker is hidden by removing it from layout, not by making it
			// transparent as obsidian does for its own quotes: a transparent `> `
			// would push the first line's text past the wrapped lines
			const isActive = selection.ranges.some((r) => r.from <= line.to && r.to >= line.from);
			builder.add(markerFrom, textFrom, isActive ? shownMarker : hiddenMarker);
			if (textFrom < line.to) {
				builder.add(textFrom, line.to, quoteText);
			}
		}
	}
	return builder.finish();
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
			if (update.docChanged || update.viewportChanged || update.selectionSet || modeChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);
