import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';

// a list marker (bullet, number, or task box) whose content opens with a quote
// marker. obsidian's parser already handles an indented `>` on its own line;
// this is the one shape it leaves as plain text.
const QUOTE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[^\]]\]\s+)?(>)(\s+|$)/;

// token names obsidian's stream parser gives text that only looks like markdown
const NOT_MARKDOWN = /codeblock|comment|math|frontmatter/;

const hiddenMarker = Decoration.replace({});
const shownMarker = Decoration.mark({ class: 'cm-formatting cm-formatting-quote bullet-quote-marker' });
const quoteText = Decoration.mark({ class: 'cm-quote bullet-quote-text' });

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
			const match = QUOTE_ITEM.exec(line.text);
			if (!match) {
				continue;
			}
			const markerFrom = line.from + match[0].length - (match[1]?.length ?? 0) - (match[2]?.length ?? 0);
			const textFrom = line.from + match[0].length;
			if (NOT_MARKDOWN.test(tree.resolveInner(markerFrom, 1).name)) {
				continue;
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
