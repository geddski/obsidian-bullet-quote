const QUOTE_LINE = /^\s*>\s?/;

// obsidian's reading view leaves `- > quote` as the literal text "> quote"
// inside the list item; wrap that text (and any `>` lines after a <br>) in a
// real blockquote. a no-op on items it already parsed, since those hold a
// <blockquote> rather than a text node starting with `>`.
export function renderBulletQuotes(el: HTMLElement) {
	for (const li of Array.from(el.querySelectorAll('li'))) {
		const container = quoteContainer(li);
		if (!container) {
			continue;
		}
		const start = firstTextNode(container);
		if (!start || !/^\s*>(\s|$)/.test(start.data)) {
			continue;
		}
		const quote = container.createEl('blockquote');
		container.insertBefore(quote, start);
		let node: ChildNode | null = start;
		let atLineStart = true;
		while (node) {
			const next: ChildNode | null = node.nextSibling;
			if (node.instanceOf(HTMLBRElement)) {
				const after = next instanceof Text ? next : null;
				if (!after || !QUOTE_LINE.test(after.data)) {
					break;
				}
				atLineStart = true;
			} else if (node.instanceOf(HTMLUListElement) || node.instanceOf(HTMLOListElement)) {
				break;
			} else if (node.instanceOf(Text) && atLineStart) {
				node.data = node.data.replace(QUOTE_LINE, '');
				atLineStart = false;
			}
			quote.appendChild(node);
			node = next;
		}
	}
}

// loose lists wrap item text in a <p>; tight lists put it straight in the <li>
function quoteContainer(li: HTMLLIElement): HTMLElement | null {
	for (const child of Array.from(li.childNodes)) {
		if (child.instanceOf(Text) && child.data.trim() === '') {
			continue;
		}
		if (child.instanceOf(HTMLInputElement)) {
			continue;
		}
		if (child.instanceOf(HTMLParagraphElement)) {
			return child;
		}
		return child.instanceOf(Text) ? li : null;
	}
	return null;
}

function firstTextNode(container: HTMLElement): Text | null {
	for (const child of Array.from(container.childNodes)) {
		if (child.instanceOf(HTMLInputElement)) {
			continue;
		}
		if (child.instanceOf(Text)) {
			if (child.data.trim() === '') {
				continue;
			}
			return child;
		}
		return null;
	}
	return null;
}
