'use babel';

import { MagitTextEditor } from './magit-text-editor';

const MAGIT_COLORS = {
	'section': 'red',
	'key': 'red',
	'activeDesc': 'white',
	'inactiveDesc': 'gray'
};

export default class MagitPopup extends MagitTextEditor {
	constructor(cwd: String) {
		super(cwd);
	}

	/***************************************************************************
	 * Methods for an opener
	 **************************************************************************/

	getDefaultLocation(): String {
		return 'bottom';
	}

	getAllowedLocations(): String[] {
		return ['bottom'];
	}

	/***************************************************************************
	 * Update Sections
	 **************************************************************************/

	async update() {
		this.editor.update({
			showLineNumbers: false,
			showInvisibles: false
		});
		this.gutter.hide();
		this.setText('');

		let firstLine = true;
		for (const section of this.keybindings) {
			if (section.sectionName.startsWith(' ')) {
				continue;
			}
			if (firstLine) {
				firstLine = false;
			} else {
				this.insertText('\n\n');
			}
			this.insertText(`${section.sectionName}`, MAGIT_COLORS['section']);
			const column = section.keyDescriptions.length;
			const keyLens = [];
			const descLens = [];
			let line = 0;
			for (const items of section.keyDescriptions) {
				if (items.length > line) {
					line = items.length;
				}
				let keyLen = 0;
				let descLen = 0;
				for (const item of items) {
					if (item.key.length > keyLen) {
						keyLen = item.key.length;
					}
					if (item.desc.length > descLen) {
						descLen = item.desc.length;
					}
				}
				keyLens.push(keyLen);
				descLens.push(descLen);
			}

			let l, c;
			for (l = 0; l < line; l++) {
				this.insertText('\n');
				for (c = 0; c < column; c++) {
					if (section.keyDescriptions[c].length <= l) {
						continue;
					}
					key = section.keyDescriptions[c][l].key.padEnd(keyLens[c]);
					desc = section.keyDescriptions[c][l].desc.padEnd(descLens[c]);
					this.insertText(` ${key}`, MAGIT_COLORS['key']);
					this.insertText(` ${desc}  `, MAGIT_COLORS['activeDesc']);
				}
			}
		}

		this.editor.setCursorBufferPosition([0, 0]);
	}
}
