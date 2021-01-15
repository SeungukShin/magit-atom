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
	foldInfo: FoldInfo;

	constructor(editor: TextEditor, buffer: TextBuffer, gutter: Gutter) {
		this.editor = editor;
		this.buffer = buffer;
		this.gutter = gutter;
		this.foldInfo = new FoldInfo(buffer.getRange());
	}

	destroy() {
		this.foldInfo.destroy();
	}

	reset() {
		this.foldInfo.destroy();
		this.foldInfo = new FoldInfo(this.buffer.getRange());
	}

	add(range: Range): void {
		const foldInfo = new FoldInfo(range);
		foldInfo.item = document.createElement('span');
		foldInfo.item.innerText = '\u25bc';
		foldInfo.marker = this.editor.markBufferPosition([range.start.row, 0]);
		this.gutter.decorateMarker(foldInfo.marker, { item: foldInfo.item });
		this.foldInfo.add(foldInfo);
		foldInfo.item.addEventListener('click', (event) => {
			foldInfo.toggle(foldInfo.range.start.row, this.editor);
		});
		return;
	}

	toggle(line: Number): void {
		this.foldInfo.toggle(line, this.editor);
	}
}
