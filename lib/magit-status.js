'use babel';

import { CompositeDisposable, TextEditor, Range, DisplayMarker } from 'atom';
import Log from './log';
import Git from './git';
import GitStatus from './git-status';
import GitStash from './git-stash';
import GitLog from './git-log';

const GIT_STATUS_COLORS = {
	'head': 'white',
	'subject': 'white',
	'local': 'cyan',
	'remote': 'green',
	'tag': 'yellow',
	'hash': 'gray',
	'section': 'yellow'
};

export default class MagitStatus {
	cwd: String;
	git: Git;
	gitStatus: GitStatus;
	subscriptions: CompositeDisposable;
	markers: DisplayMarker[];
	editor: TextEditor;

	constructor(cwd: String) {
		this.cwd = cwd;
		this.git = new Git(cwd);

		this.subscriptions = new CompositeDisposable();
		this.markers = [];
		this.editor = atom.workspace.buildTextEditor({ readOnly: true, autoHeight: false });
		const grammar = atom.grammars.grammarForScopeName('source.magit');
		this.editor.setGrammar(grammar);
		this.subscriptions.add(atom.commands.add(this.editor.element, {
			'core:cancel': () => {
				const pane = atom.workspace.getActivePane();
				const item = pane.getActiveItem();
				pane.destroyItem(item);
			}
		}));
	}

	destroy() {
		this.subscriptions.dispose();
		for (const marker of this.markers) {
			marker.destroy();
		}
	}

	getTitle(): String {
		return 'status.magit';
	}

	getDefaultLocation(): String {
		return 'bottom';
	}

	getAllowedLocations(): String[] {
		return ['left', 'right', 'bottom'];
	}

	getURI(): String {
		return 'atom://magit-atom/status.magit';
	}

	getElement(): Element {
		return this.editor.element;
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
				color = GIT_STATUS_COLORS['subject'];
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

	async insertSummary() {
		// Head
		const head = await this.git.getLog('HEAD');
		this.insertText('Head:'.padEnd(10), GIT_STATUS_COLORS['head']);
		const locals = head.getLabels('locals');
		if (locals.length > 0) {
			for (const local of locals) {
				this.insertText(` ${local}`, GIT_STATUS_COLORS['local']);
			}
		} else {
			const hash = head.getHash();
			this.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
		}
		const subject = head.getSubject();
		this.insertText(` ${subject}\n`, GIT_STATUS_COLORS['subject']);

		// Remote
		const local = await this.git.getCurrentBranch();
		const upstream = await this.git.getUpstream();
		if (local.length > 0 && upstream.length > 0) {
			let msg = '';
			const rebase = await this.git.getConfig(`branch.${local}.rebase`);
			if (rebase.length > 0) {
				msg = 'Rebase:'.padEnd(10);
			} else {
				const merge = await this.git.getConfig(`branch.${local}.merge`);
				if (merge.length > 0) {
					msg = 'Merge:'.padEnd(10);
				}
			}
			if (msg.length > 0) {
				const gitLog = await this.git.getLog(upstream);
				const subject = gitLog.getSubject();
				this.insertText(msg, GIT_STATUS_COLORS['head']);
				this.insertText(` ${upstream}`, GIT_STATUS_COLORS['remote']);
				this.insertText(` ${subject}\n`, GIT_STATUS_COLORS['subject']);
			}

			let remote = await this.git.getConfig(`branch.${local}.pushRemote`);
			if (remote.length <= 0) {
				remote = await this.git.getConfig('branch.pushDefault');
			}
			if (remote.length > 0) {
				const gitLog = await this.git.getLog(remote);
				const subject = gitLog.getSubject();
				this.insertText('Push:'.padEnd(10), GIT_STATUS_COLORS['head']);
				this.insertText(` ${remote}`, GIT_STATUS_COLORS['remote']);
				this.insertText(` ${subject}\n`, GIT_STATUS_COLORS['subject']);
			}
		}

		// Tag
		const tag = await this.git.getTag();
		if (tag.length > 0) {
			this.insertText('Tag:'.padEnd(10), GIT_STATUS_COLORS['head']);
			const list = tag.split('-');
			if (list.length > 1) {
				this.insertText(` ${list[0]}`, GIT_STATUS_COLORS['tag']);
				this.insertText(' (', GIT_STATUS_COLORS['subject']);
				this.insertText(`${list[1]}`, GIT_STATUS_COLORS['local']);
				this.insertText(')\n', GIT_STATUS_COLORS['subject']);
			} else {
				this.insertText(` ${tag}\n`, GIT_STATUS_COLORS['tag']);
			}
		}
	}

	async insertStatus() {
		this.gitStatus = await this.git.getStatus();

		// Untracked files
		const untrackedFiles = this.gitStatus.getUntrackedFiles();
		if (untrackedFiles.length > 0) {
			this.insertText('\n');
			this.insertText('Untracked files', GIT_STATUS_COLORS['section']);
			this.insertText(` (${untrackedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const file of untrackedFiles) {
				this.insertText(`${file}\n`, GIT_STATUS_COLORS['subject']);
			}
		}

		// Unstaged changes
		const unstagedFiles = this.gitStatus.getUnstagedFiles();
		if (unstagedFiles.length > 0) {
			this.insertText('\n');
			this.insertText('Unstaged changes', GIT_STATUS_COLORS['section']);
			this.insertText(` (${unstagedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const file of unstagedFiles) {
				this.insertText(`${file.status}   ${file.file}\n`, GIT_STATUS_COLORS['subject']);
			}
		}

		// Staged changes
		const stagedFiles = this.gitStatus.getStagedFiles();
		if (stagedFiles.length > 0) {
			this.insertText('\n');
			this.insertText('Staged changes', GIT_STATUS_COLORS['section']);
			this.insertText(` (${stagedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const file of stagedFiles) {
				this.insertText(`${file.status}   ${file.file}\n`, GIT_STATUS_COLORS['subject']);
			}
		}
	}

	async insertLogs(logs: GitLog[]) {
		for (const log of logs) {
			this.insertText(log.getHash(), GIT_STATUS_COLORS['hash']);
			const locals = log.getLabels('locals');
			for (const local of locals) {
				this.insertText(' ');
				this.insertText(local, GIT_STATUS_COLORS['local'], true);
			}
			const remotes = log.getLabels('remotes');
			for (const remote of remotes) {
				this.insertText(` ${remote}`, GIT_STATUS_COLORS['remote']);
			}
			const tags = log.getLabels('tags');
			for (const tag of tags) {
				this.insertText(` ${tag}`, GIT_STATUS_COLORS['tag']);
			}
			this.insertText(` ${log.getSubject()}\n`, GIT_STATUS_COLORS['subject']);
		}
	}

	async update() {
		this.setText('');

		// Summary
		await this.insertSummary();

		// Status
		await this.insertStatus();

		// Stashes
		const stashes = await this.git.getStashes();
		if (stashes.length > 0) {
			this.insertText('\n');
			this.insertText('Stashes', GIT_STATUS_COLORS['section']);
			this.insertText(` (${stashes.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const stash of stashes) {
				this.insertText(`stash@{${stash.getID()}}`, GIT_STATUS_COLORS['hash']);
				this.insertText(` ${stash.getSubject()}\n`, GIT_STATUS_COLORS['subject']);
			}
		}

		// Commits
		const currentBranch = this.gitStatus.getCurrentBranch();
		const remoteBranch = this.gitStatus.getRemoteBranch();
		const commits = this.gitStatus.getCommitCounts();
		if ((currentBranch.length > 0 && remoteBranch.length > 0) &&
			(commits[0] > 0 || commits[1] > 0)) {
			// Unmerged commits
			const unmergedLogs = await this.git.getLogs([`${remoteBranch}..${currentBranch}`]);
			if (unmergedLogs.length > 0) {
				this.insertText('\n');
				this.insertText('Unmerged into', GIT_STATUS_COLORS['section']);
				this.insertText(` ${remoteBranch}`, GIT_STATUS_COLORS['remote']);
				this.insertText(` (${unmergedLogs.length})\n`, GIT_STATUS_COLORS['subject']);
				this.insertLogs(unmergedLogs);
			}

			// Unpulled commits
			const unpulledLogs = await this.git.getLogs([`${currentBranch}..${remoteBranch}`]);
			if (unpulledLogs.length > 0) {
				this.insertText('\n');
				this.insertText('Unpulled from', GIT_STATUS_COLORS['section']);
				this.insertText(` ${remoteBranch}`, GIT_STATUS_COLORS['remote']);
				this.insertText(` (${unpulledLogs.length})\n`, GIT_STATUS_COLORS['subject']);
				this.insertLogs(unpulledLogs);
			}
		} else {
			// Recent commits
			const logs = await this.git.getLogs(['-10']);
			if (logs.length > 0) {
				this.insertText('\n');
				this.insertText('Recent commits\n', GIT_STATUS_COLORS['section']);
				this.insertLogs(logs);
			}
		}

		this.editor.setCursorBufferPosition([0, 0]);
	}
}
