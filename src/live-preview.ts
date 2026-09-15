import { syntaxTree } from '@codemirror/language';
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import type { Line, Range, Text } from '@codemirror/state';
import type { Tree } from '@lezer/common';
import { editorLivePreviewField } from 'obsidian';

// a list marker (bullet, number, or task box) whose content opens with a quote
// marker. obsidian's parser leaves this shape as plain text.
const QUOTE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[^\]]\]\s+)?(>)(\s+|$)/;

// an indented quote line. obsidian renders it, but puts the bar at the left
// margin instead of under the list item it belongs to.
const QUOTE_CONT = /^(\s+)(>)(\s?)/;

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(\[[^\]]\]\s+)?/;

// token names obsidian's stream parser gives text that only looks like markdown
const NOT_MARKDOWN = /codeblock|comment|math|frontmatter/;

interface Owner {
	indent: string;
	marker: string;
	isOrdered: boolean;
	isTask: boolean;
	level: number;
}

// zero-width anchor for the bar; the css draws it at line height from here
function barEl(parent: HTMLElement) {
	parent.createSpan({ cls: 'bullet-quote-bar' });
}

class BarWidget extends WidgetType {
	toDOM() {
		const el = createSpan();
		barEl(el);
		return el;
	}
	eq() {
		return true;
	}
	ignoreEvent() {
		return true;
	}
}

// stands in for a continuation line's leading whitespace and `>`: an invisible
// copy of the owning item's marker, built from the same classes obsidian uses,
// so it is exactly as wide as the real one. that puts the bar where the
// item's content starts, and obsidian's hanging-indent measurement of the
// line comes out the same as the item's, so wrapped text lines up as well.
class OwnerMarkerWidget extends WidgetType {
	constructor(readonly owner: Owner) {
		super();
	}

	toDOM() {
		const { indent, marker, isOrdered, isTask, level } = this.owner;
		const el = createSpan();
		const fake = el.createSpan({ cls: 'bullet-quote-fake', attr: { 'aria-hidden': 'true' } });
		if (indent) {
			fake
				.createSpan({ cls: `cm-hmd-list-indent cm-hmd-list-indent-${level - 1}` })
				.createSpan({ cls: 'cm-indent', text: indent });
		}
		if (isTask) {
			fake
				.createEl('label', { cls: 'task-list-label' })
				.createEl('input', { cls: 'task-list-item-checkbox', type: 'checkbox', attr: { disabled: '' } });
			fake.createSpan({ cls: `cm-list-${level}`, text: ' ' });
		} else {
			const kind = isOrdered ? 'ol' : 'ul';
			const formatting = fake.createSpan({ cls: `cm-formatting cm-formatting-list cm-formatting-list-${kind} cm-list-${level}` });
			if (isOrdered) {
				formatting.createSpan({ cls: 'list-number', text: `${marker} ` });
			} else {
				formatting.createSpan({ cls: 'list-bullet', text: marker });
				formatting.appendText(' ');
			}
		}
		barEl(el);
		return el;
	}

	eq(other: OwnerMarkerWidget) {
		const a = this.owner;
		const b = other.owner;
		return (
			a.indent === b.indent &&
			a.marker === b.marker &&
			a.isOrdered === b.isOrdered &&
			a.isTask === b.isTask &&
			a.level === b.level
		);
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

// the list item a continuation quote line belongs to: the nearest item above
// at the same list level. gives up on hitting a shallower item first.
function findOwner(doc: Text, tree: Tree, line: Line, level: number): Owner | null {
	for (let n = line.number - 1; n >= 1; n--) {
		const candidate = doc.line(n);
		const m = LIST_ITEM.exec(candidate.text);
		if (!m) {
			continue;
		}
		const indent = m[1] ?? '';
		const token = tree.resolveInner(candidate.from + indent.length, 1).name;
		const found = /list-(\d+)/.exec(token);
		if (!found || !/formatting-list/.test(token)) {
			continue;
		}
		const candidateLevel = Number(found[1]);
		if (candidateLevel < level) {
			return null;
		}
		if (candidateLevel === level) {
			const marker = m[2] ?? '';
			return { indent, marker, isOrdered: /\d/.test(marker), isTask: !!m[3], level };
		}
	}
	return null;
}

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
			const isActive = selection.ranges.some((r) => r.from <= line.to && r.to >= line.from);
			if (cont) {
				// only quotes the parser placed inside a list item; a plain
				// indented quote elsewhere keeps obsidian's rendering
				const level = /formatting-quote/.test(token) ? /list-(\d+)/.exec(token) : null;
				if (!level) {
					continue;
				}
				const owner = findOwner(doc, tree, line, Number(level[1]));
				if (!owner) {
					continue;
				}
				ranges.push(inListQuoteLine.range(line.from));
				const ownerMarker = Decoration.replace({ widget: new OwnerMarkerWidget(owner) });
				if (isActive) {
					ranges.push(ownerMarker.range(line.from, markerFrom));
					ranges.push(shownMarker.range(markerFrom, textFrom));
				} else {
					ranges.push(ownerMarker.range(line.from, textFrom));
				}
			} else if (isActive) {
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
