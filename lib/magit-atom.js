'use babel';

import { CompositeDisposable } from 'atom';
import Log from './log';
import MagitStatus from './magit-status';
import MagitPopup from './magit-popup';

class MagitAtom {
	subscriptions: CompositeDisposable;
	magitStatus: MagitStatus;

	activate() {
		this.subscriptions = new CompositeDisposable();
		this.magitStatus = null;

		// Add openers
		this.subscriptions.add(atom.workspace.addOpener((uri) => {
			switch (uri) {
				case 'atom://magit-atom/status.magit':
					return new MagitStatus(this.getCurrentDirectory());
				case 'atom://magit-atom/popup.magit':
					return new MagitPopup(this.getCurrentDirectory());
				default:
					return null;
			}
		}));

		// Register commands
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'magit-atom:status': () => {
				atom.workspace.open('atom://magit-atom/status.magit').then((magitStatus) => {
					if (this.magitStatus) {
						this.magitStatus.destroy();
					}
					this.magitStatus = magitStatus;
					magitStatus.update();
				});
			},
			'magit-atom:update-status': () => {
				if (this.magitStatus) {
					this.magitStatus.update();
				}
			}
		}));

		Log.info('"magit-atom" is now active!');
	}

	deactivate() {
		this.subscriptions.dispose();
		if (this.magitStatus) {
			this.magitStatus.destroy();
		}

		Log.info('"magit-atom" is now inactive!');
	}

	getCurrentDirectory(): String {
		const projects = atom.project.getPaths();
		if (projects.length > 0) {
			return projects[0];
		}
		const editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			const file = editor.getPath();
			return path.dirname(file);
		}
		if (process.env.home) {
			return process.env.home;
		}
		return '';
	}

	async status() {
		if (this.magitStatus) {
			this.magitStatus.destroy();
		}
		this.magitStatus = new MagitStatus(this.getCurrentDirectory());
		this.magitStatus.show();
	}
}

const magitAtom = new MagitAtom();
export default magitAtom;
