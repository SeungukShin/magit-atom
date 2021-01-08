'use babel';

import { CompositeDisposable, TextEditor, Panel, Range, DisplayMarker } from 'atom';

export default class MagitAtomView {
	subscriptions: CompositeDisposable;
	markers: DisplayMarker[];
	editor: TextEditor;
	panel: Panel;
	prevElement: Element;

	constructor() {
		this.subscriptions = new CompositeDisposable();
		this.markers = [];
		this.editor = new TextEditor({ autoHeight: false });
		this.panel = atom.workspace.addBottomPanel({
			item: this.editor.element,
			visible: false
		});
		this.subscriptions.add(atom.commands.add(this.editor.element, {
			'core:cancel': () => {
				this.hide();
			}
		}));
		this.editor.setReadOnly(true);
	}

	destroy() {
		this.subscriptions.dispose();
		for (const marker of this.markers) {
			marker.destroy();
		}
	}

	show(): void {
		this.prevElement = document.activeElement;

		const size = atom.getSize();
		this.editor.element.setHeight(size.height * 30 / 100);

		this.panel.show();
		this.editor.element.focus();
	}

	hide(): void {
		this.panel.hide();
		if (this.prevElement) {
			this.prevElement.focus();
			this.prevElement = null;
		}
	}

	setText(msg: String): void {
		for (const marker of this.markers) {
			marker.destroy();
		}
		this.markers = [];
		this.editor.setText(msg, { bypassReadOnly: true });
	}

	insertText(msg: String, color: String = '', border: Boolean = false): void {
		const range = this.editor.insertText(msg, { bypassReadOnly: true });
		if (range && (color.length > 0 || border == true)) {
			if (color.length == 0) {
				color = 'white';
			}
			const marker = this.editor.markBufferRange(range[0], { invalidate: 'never' });
			this.markers.push(marker);
			if (border) {
				this.editor.decorateMarker(marker, { type: 'text', style: { color: color, borderStyle: 'solid' } });
			} else {
				this.editor.decorateMarker(marker, { type: 'text', style: { color: color, borderStyle: 'none' } });
			}
		}
	}
}
