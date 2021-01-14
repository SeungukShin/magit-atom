'use babel';

import * as path from 'path';
import { CompositeDisposable, TextEditor, Range, DisplayMarker } from 'atom';
import Log from './log';
import Git, { GitTag } from './git';
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
		const dirs = this.cwd.split(path.sep);
		return 'magit: ' + dirs[dirs.length - 1];
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

	async insertHeadBranchHeader(branch: String = null) {
		if (!branch) {
			branch = await this.git.getCurrentBranch();
		}
		const ref = (branch.length > 0) ? branch : 'HEAD';
		const gitLog = await this.git.getLog(ref);

		this.insertText('Head:'.padEnd(10), GIT_STATUS_COLORS['head']);
		if (branch.length > 0) {
			this.insertText(` ${branch}`, GIT_STATUS_COLORS['local']);
		} else {
			const hash = gitLog.getHash();
			this.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
		}
		const subject = gitLog.getSubject();
		const msg = (subject.length > 0) ? subject : '(no commit message)';
		this.insertText(` ${msg}\n`, GIT_STATUS_COLORS['subject']);
	}

	async insertUpstreamBranchHeader(branch: String = null) {
		if (!branch) {
			branch = await this.git.getCurrentBranch();
		}
		const remote = await this.git.getRemote(branch);
		const merge = await this.git.getMerge(branch);
		const rebase = await this.git.getRebase(branch);
		let upstream = '';
		if (remote.length > 0 || merge.length > 0) {
			upstream = await this.git.getUpstreamBranch();

			const rebaseConfig = await this.git.getConfig('pull.rebase');
			if (rebase.length > 0 || rebaseConfig === 'true') {
				this.insertText('Rebase:'.padEnd(10), GIT_STATUS_COLORS['head']);
			} else {
				this.insertText('Merge:'.padEnd(10), GIT_STATUS_COLORS['head']);
			}

			if (upstream.length > 0) {
				const gitLog = await this.git.getLog(upstream);
				const subject = gitLog.getSubject();
				const msg = (subject.length > 0) ? subject : '(no commit message)';
				this.insertText(` ${upstream}`, GIT_STATUS_COLORS['remote']);
				this.insertText(` ${msg}\n`, GIT_STATUS_COLORS['subject']);
			} else {
				if (merge.length <= 0) {
					this.insertText(' invalid upstream configuration\n');
				} else if (remote.length <= 0) {
					this.insertText(` ${merge}`, GIT_STATUS_COLORS['remote']);
					this.insertText(' does not exist\n');
				} else {
					this.insertText(` ${merge}`, GIT_STATUS_COLORS['remote']);
					this.insertText(' from', GIT_STATUS_COLORS['head']);
					this.insertText(` ${remote}\n`, GIT_STATUS_COLORS['remote']);
				}
			}
		}
	}

	async insertPushBranchHeader() {
		const push = await this.git.getPushBranch();
		if (push.length > 0) {
			const gitLog = await this.git.getLog(push);
			const subject = gitLog.getSubject();
			const msg = (subject.length > 0) ? subject : '(no commit message)';
			this.insertText('Push:'.padEnd(10), GIT_STATUS_COLORS['head']);
			this.insertText(` ${push}`, GIT_STATUS_COLORS['remote']);
			this.insertText(` ${msg}\n`, GIT_STATUS_COLORS['subject']);
		}
	}

	async insertTagsHeader() {
		const currTag = await this.git.getCurrTag();
		const nextTag = await this.git.getNextTag();
		if (currTag.name === nextTag.name) {
			nextTag.name = '';
		}
		console.log(currTag, nextTag);
		const bothTag = (currTag.name.length > 0 && nextTag.name.length > 0);
		if (currTag.name.length <= 0 && nextTag.name.length <= 0) {
			return;
		}
		const head = (bothTag) ? 'Tags:' : 'Tag:';
		this.insertText(head.padEnd(10), GIT_STATUS_COLORS['head']);
		if (currTag.name.length > 0) {
			this.insertText(` ${currTag.name}`, GIT_STATUS_COLORS['tag']);
			if (currTag.dist > 0) {
				this.insertText(' (', GIT_STATUS_COLORS['subject']);
				this.insertText(`${currTag.dist}`, GIT_STATUS_COLORS['local']);
				this.insertText(')', GIT_STATUS_COLORS['subject']);
			}
		}
		if (bothTag) {
			this.insertText(',', GIT_STATUS_COLORS['subject']);
		}
		if (nextTag.name.length > 0) {
			this.insertText(` ${currTag.name}`, GIT_STATUS_COLORS['tag']);
			if (nextTag.dist > 0) {
				this.insertText(' (', GIT_STATUS_COLORS['subject']);
				this.insertText(`${nextTag.dist}`, GIT_STATUS_COLORS['tag']);
				this.insertText(')', GIT_STATUS_COLORS['subject']);
			}
		}
		this.insertText('\n');
	}

	async insertHeaders() {
		const branch = await this.git.getCurrentBranch();

		await this.insertHeadBranchHeader(branch);
		await this.insertUpstreamBranchHeader(branch);
		await this.insertPushBranchHeader();
		await this.insertTagsHeader();
	}

	async insertLogs(logs: GitLog[]) {
		for (const log of logs) {
			this.insertText(log.getHash(), GIT_STATUS_COLORS['hash']);
			const locals = log.getLabels('locals');
			for (const local of locals) {
				this.insertText(' ', GIT_STATUS_COLORS['subject'], false);
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

	async insertMergeLog() {
		if (!this.git.mergeInProgress()) {
			return;
		}
		const mergeHead = this.git.getMergeHead();
		const shortMergeHead = await this.getSymRev(mergeHead);
		const gitLogs = await this.git.getLogs([`HEAD..${shortMergeHead}`]);
		if (gitLogs.length > 0) {
			this.insertText('\n');
			this.insertText(`Merging ${shortMergeHead}`, GIT_STATUS_COLORS['section']);
			this.insertText(` (${gitLogs.length})\n`, GIT_STATUS_COLORS['subject']);
			this.insertLogs(gitLogs);
		}
	}

	async insertRebaseMergeSeq() {
		let i;

		const todos = this.git.getRebaseMergeTodo();
		const dones = this.git.getRebaseMergeDone();
		const curr = this.git.getRebaseMergeStop();

		// todo
		for (i = todos.length - 1; i >= 0; i--) {
			const hash = await this.git.getSymRev(todos[i].hash);
			if (todos[i].hash === curr) {
				this.insertText('join', GIT_STATUS_COLORS['tag']);
			} else {
				this.insertText(todos[i].act, GIT_STATUS_COLORS['subject']);
			}
			this.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
			this.insertText(` ${todos[i].subject}\n`, GIT_STATUS_COLORS['subject']);
		}

		// done
		for (i = dones.length - 1; i >= 0; i--) {
			const hash = await this.git.getSymRev(dones[i].hash);
			if (dones[i].hash === curr) {
				this.insertText('join', GIT_STATUS_COLORS['tag']);
			} else {
				this.insertText('done', GIT_STATUS_COLORS['local']);
			}
			this.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
			this.insertText(` ${dones[i].subject}\n`, GIT_STATUS_COLORS['subject']);
		}
	}

	async insertRebaseApplySeq() {
		let i;

		const todos = this.git.getRebaseApplyTodo();
		const dones = this.git.getRebaseApplyRewritten();
		const curr = this.git.getRebaseApplyOriginalCommit();

		// todo
		for (i = todos.length - 1; i >= dones.length; i--) {
			const hash = await this.git.getSymRev(todos[i].hash);
			if (todos[i].hash === curr) {
				this.insertText('join', GIT_STATUS_COLORS['tag']);
			} else {
				this.insertText(todos[i].act, GIT_STATUS_COLORS['subject']);
			}
			this.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
			this.insertText(` ${todos[i].subject}\n`, GIT_STATUS_COLORS['subject']);
		}

		// done
		for (i = dones.length - 1; i >= 0; i--) {
			const log = await this.git.getLog(dones[i].newItem);
			const hash = log.getHash();
			const subject = log.getSubject();
			const msg = (subject.length > 0) ? subject : '(no commit message)';
			this.insertText('done', GIT_STATUS_COLORS['local']);
			this.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
			this.insertText(` ${msg}\n`, GIT_STATUS_COLORS['subject']);
		}
	}

	async insertRebaseSeq() {
		if (!this.git.rebaseInProgress()) {
			return;
		}
		const headName = this.git.getRebaseHeadName();
		const onto = this.git.getRebaseOnto();
		const ontoName = await this.git.getRevName(onto);
		this.insertText('\n');
		this.insertText(`Rebasing ${headName} onto ${ontoName}\n`, GIT_STATUS_COLORS['section']);

		if (this.git.rebaseMergeInProgress()) {
			await this.insertRebaseMergeSeq();
		} else {
			await this.insertRebaseApplySeq();
		}

		const log = await this.git.getLog(onto);
		const hash = log.getHash();
		const subject = log.getSubject();
		const msg = (subject.length > 0) ? subject : '(no commit message)';
		this.insertText('onto', GIT_STATUS_COLORS['hash']);
		this.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
		this.insertText(` ${msg}\n`, GIT_STATUS_COLORS['subject']);
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

	// '(magit-insert-status-headers
	//   magit-insert-merge-log

	//   magit-insert-rebase-sequence
	//   magit-insert-am-sequence
	//   magit-insert-sequencer-sequence
	//   magit-insert-bisect-output
	//   magit-insert-bisect-rest
	//   magit-insert-bisect-log
	//   magit-insert-untracked-files
	//   magit-insert-unstaged-changes
	//   magit-insert-staged-changes
	//   magit-insert-stashes
	//   magit-insert-unpushed-to-pushremote
	//   magit-insert-unpushed-to-upstream-or-recent
	//   magit-insert-unpulled-from-pushremote
	//   magit-insert-unpulled-from-upstream)

	async update() {
		this.setText('');

		await this.insertHeaders();
		await this.insertMergeLog();
		await this.insertRebaseSeq();

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
