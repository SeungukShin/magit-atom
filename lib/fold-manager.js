'use babel';

import { TextEditor, Range, DisplayMarker, Gutter } from 'atom';

class FoldInfo {
	range: Range;
	item: Element;
	marker: DisplayMarker;
	children: FoldInfo[];

	constructor(range: Range) {
		this.range = range;
		this.children = [];
	}

	destroy() {
		for (const child of this.children) {
			child.destroy();
		}
		if (this.marker) {
			this.marker.destroy();
		}
	}

	add(info: FileInfo): void {
		for (const child of this.children) {
			if (info.range.start.row < child.range.start.row) {
				continue;
			}
			if (info.range.end.row > child.range.end.row) {
				continue;
			}
			child.add(info);
			return;
		}
		this.children.push(info);
		return;
	}

	toggle(line: Number, editor: TextEditor): Boolean {
		for (const child of this.children) {
			if (line < child.range.start.row) {
				continue;
			}
			if (line > child.range.end.row) {
				continue;
			}
			return child.toggle(line, editor);
		}
		if (line < this.range.start.row) {
			return false;
		}
		if (line > this.range.end.row) {
			return false;
		}
		if (editor.isFoldedAtBufferRow(line)) {
			editor.unfoldBufferRow(line);
			this.item.innerText = '\u25bc';
		} else {
			editor.setSelectedBufferRange(this.range);
			editor.foldSelectedLines();
			this.item.innerText = '\u25b6';
		}
		return true;
	}
}

export default class FoldManager {
	editor: TextEditor;
	buffer: TextBuffer;
	gutter: Gutter;
	root: FoldInfo;

	constructor(editor: TextEditor, buffer: TextBuffer, gutter: Gutter) {
		this.editor = editor;
		this.buffer = buffer;
		this.gutter = gutter;
		const range = buffer.getRange();
		this.root = new FoldInfo(range.negate());
	}

	destroy() {
		this.root.destroy();
	}

	reset() {
		this.root.destroy();
		const range = this.buffer.getRange();
		this.root = new FoldInfo(range.negate());
	}

	add(range: Range): void {
		const info = new FoldInfo(range);
		info.item = document.createElement('span');
		info.item.innerText = '\u25bc';
		info.marker = this.editor.markBufferPosition([range.start.row, 0]);
		this.gutter.decorateMarker(info.marker, { item: info.item });
		this.root.add(info);
		info.item.addEventListener('click', (event) => {
			info.toggle(info.range.start.row, this.editor);
		});
		return;
	}

	toggle(line: Number): void {
		this.root.toggle(line, this.editor);
	}
}
