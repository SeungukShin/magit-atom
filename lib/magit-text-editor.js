'use babel';

import * as path from 'path';
import { CompositeDisposable, TextEditor, TextBuffer, Point, DisplayMarker, Gutter } from 'atom';
import FoldManager from './fold-manager';
import Git from './git';

export class KeyDescription {
	key: String;
	desc: String;
	cb: Function;
}

export class SectionDescription {
	sectionName: String;
	keyDescriptions: [];	// array of KeyDescription[]
}

export class MagitTextEditor {
	cwd: String;
	git: Git;
	subscriptions: CompositeDisposable;
	markers: DisplayMarker[];
	editor: TextEditor;
	buffer: TextBuffer;
	gutter: Gutter;
	foldManager: FoldManager;
	keybindings: SectionDescription[];
	popup: MagitTextEditor;

	constructor(cwd: String) {
		this.cwd = cwd;
		this.git = new Git(cwd);

		this.subscriptions = new CompositeDisposable();
		this.markers = [];
		this.editor = atom.workspace.buildTextEditor({ readOnly: true, autoHeight: false });
		const grammar = atom.grammars.grammarForScopeName('source.magit');
		this.editor.setGrammar(grammar);
		this.buffer = this.editor.getBuffer();
		this.gutter = this.editor.addGutter({ name: 'MagitAtomGutter', priority: 100 });
		this.foldManager = new FoldManager(this.editor, this.buffer, this.gutter);
		this.keybindings = [];
		this.popup = null;
		this.subscriptions.add(atom.commands.add(this.editor.element, {
			'core:cancel': () => {
				const pane = atom.workspace.getActivePane();
				const item = pane.getActiveItem();
				pane.destroyItem(item);
			},
			'magit-atom:toggle-fold': () => {
				const line = this.editor.getCursorBufferPosition().row;
				this.foldManager.toggle(line);
			},
			'magit-atom:popup': () => {
				atom.workspace.open('atom://magit-atom/popup.magit').then((magitPopup) => {
					if (this.popup) {
						this.popup.destroy();
					}
					magitPopup.keybindings = this.keybindings;
					this.popup = magitPopup;
					magitPopup.update();
				});
			}
		}));
	}

	destroy() {
		if (this.popup) {
			this.popup.destroy();
		}
		this.subscriptions.dispose();
		if (this.gutter) {
			this.gutter.hide();
			//this.gutter.destroy();
		}
		for (const marker of this.markers) {
			marker.destroy();
		}
		this.foldManager.destroy();
	}

	bindKeys(): void {
		const keymaps = {};
		const keybindings = {};
		for (const section of this.keybindings) {
			for (const items of section.keyDescriptions) {
				for (const item of items) {
					keymaps[item.key] = item.cb;
				}
			}
		}
		keybindings["atom-text-editor[data-grammar='source magit']"] = keymaps;
		atom.keymaps.add('magit-atom', keybindings);
	}

	unbindKeys(): void {
		const keymaps = {};
		const keybindings = {};
		for (const section of this.keybindings) {
			for (const items of section.keyDescriptions) {
				for (const item of items) {
					keymaps[item.key] = 'unset!';
				}
			}
		}
		keybindings["atom-text-editor[data-grammar='source magit']"] = keymaps;
		atom.keymaps.add('magit-atom', keybindings);
	}

	/***************************************************************************
	 * Methods for an opener
	 **************************************************************************/

	getTitle(): String {
		const dirs = this.cwd.split(path.sep);
		return 'magit: ' + dirs[dirs.length - 1];
	}

	getDefaultLocation(): String {
		return 'center';
	}

	getAllowedLocations(): String[] {
		return ['center', 'left', 'right', 'bottom'];
	}

	getURI(): String {
		return 'atom://magit-atom/status.magit';
	}

	getElement(): Element {
		return this.editor.element;
	}

	/***************************************************************************
	 * Methods for messages
	 **************************************************************************/

	setText(msg: String): void {
		for (const marker of this.markers) {
			marker.destroy();
		}
		this.markers = [];
		this.foldManager.reset();
		this.editor.setText(msg, { bypassReadOnly: true });
	}

	insertText(msg: String, color: String = '', border: Boolean = false): void {
		const range = this.buffer.append(msg, { bypassReadOnly: true });
		if (range && (color.length > 0 || border == true)) {
			if (color.length == 0) {
				color = GIT_STATUS_COLORS['subject'];
			}
			const marker = this.editor.markBufferRange(range, { invalidate: 'never' });
			this.markers.push(marker);
			if (border) {
				this.editor.decorateMarker(marker, { type: 'text', style: { color: color, borderStyle: 'solid' } });
			} else {
				this.editor.decorateMarker(marker, { type: 'text', style: { color: color, borderStyle: 'none' } });
			}
		}
	}

	getCurrentPoint(): Point {
		return this.buffer.getEndPosition();
	}

	getPrevLinePoint(): Point {
		const range = this.buffer.rangeForRow(this.buffer.getEndPosition().row - 1);
		return range.end;
	}

	/***************************************************************************
	 * Update Sections
	 **************************************************************************/

	async update() {
		throw new Error('need to implement');
	}
}
