'use babel';

import { TextEditor, Range, DisplayMarker, Gutter } from 'atom';

class FoldInfo {
	range: Range;
	item: Element;
	marker: DisplayMarker;
	next: FoldInfo;
	firstChild: FoldInfo;

	constructor(range: Range) {
		this.range = range;
		this.next = null;
		this.firstChild = null;
	}

	destroy() {
		let child = this.firstChild;
		while (child) {
			child.destroy();
			child = child.next;
		}
		if (this.marker) {
			this.marker.destroy();
		}
	}

	add(info: FileInfo): void {
		if (!this.firstChild) {
			this.firstChild = info;
			return;
		}
		let child = this.firstChild;
		let prevChild = null;
		let nextChild = null;
		let removed = false;
		while (child) {
			removed = false;
			// find a parent
			if (info.range.start.row >= child.range.start.row &&
				info.range.end.row <= child.range.end.row) {
				return child.add(info);
			}
			// find a child
			if (info.range.start.row <= child.range.start.row &&
				info.range.end.row >= child.range.end.row) {
				// remove a child from this
				removed = true;
				nextChild = child.next;
				if (this.firstChild == child) {
					this.firstChild = child.next;
				}
				if (prevChild) {
					prevChild.next = child.next;
				}
				child.next = null;
				// add a child to info
				info.add(child);
			}
			// next child
			if (removed) {
				child = nextChild;
			} else {
				prevChild = child;
				child = child.next;
			}
		}
		if (prevChild) {
			prevChild.next = info;
		} else {
			this.firstChild = info;
		}
		return;
	}

	showChildren(editor: TextEditor): void {
		let child = this.firstChild;
		while (child) {
			if (!editor.isFoldedAtBufferRow(child.range.start.row)) {
				child.showChildren(editor);
				child.item.innerText = '\u25bc';
			}
			child = child.next;
		}
	}

	hideChildren(): void {
		let child = this.firstChild;
		while (child) {
			child.hideChildren();
			child.item.innerText = '\u25b6';
			child = child.next;
		}
	}

	toggle(line: Number, editor: TextEditor): Boolean {
		let child = this.firstChild;
		while (child) {
			if (line >= child.range.start.row &&
				line <= child.range.end.row) {
				return child.toggle(line, editor);
			}
			child = child.next;
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
			this.showChildren(editor);
		} else {
			editor.setSelectedBufferRange(this.range);
			editor.foldSelectedLines();
			this.item.innerText = '\u25b6';
			this.hideChildren();
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
	}

	add(range: Range): void {
		const info = new FoldInfo(range);
		info.item = document.createElement('span');
		info.item.innerText = '\u25bc';
		info.item.addEventListener('click', (event) => {
			info.toggle(info.range.start.row, this.editor);
		});
		info.marker = this.editor.markBufferPosition([range.start.row, 0]);
		this.gutter.decorateMarker(info.marker, { item: info.item });
		this.root.add(info);
	}

	toggle(line: Number): void {
		this.root.toggle(line, this.editor);
	}
}
