'use babel';

import { CompositeDisposable } from 'atom';
import Log from './log';
import MagitStatus from './magit-status';

class MagitAtom {
	subscriptions: CompositeDisposable;
	magitStatus: MagitStatus;

	activate() {
		this.subscriptions = new CompositeDisposable();
		this.magitStatus = null;

		// Register commands
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'magit-atom:status': () => this.status()
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
