'use babel';

import * as path from 'path';
import { CompositeDisposable, TextEditor, TextBuffer, Point, Range, DisplayMarker, Gutter } from 'atom';
import Log from './log';
import FoldManager from './fold-manager';
import Git, { GitTag } from './git';
import GitLog from './git-log';
import GitDiff, { Hunk } from './git-diff';
import GitStatus from './git-status';
import GitStash from './git-stash';

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
	buffer: TextBuffer;
	gutter: Gutter;
	foldManager: FoldManager;

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
		this.subscriptions.add(atom.commands.add(this.editor.element, {
			'core:cancel': () => {
				const pane = atom.workspace.getActivePane();
				const item = pane.getActiveItem();
				pane.destroyItem(item);
			},
			'magit-atom:toggle-fold': () => {
				const line = this.editor.getCursorBufferPosition().row;
				this.foldManager.toggle(line);
			}
		}));
	}

	destroy() {
		this.subscriptions.dispose();
		if (this.gutter) {
			this.gutter.hide();
			this.gutter.destroy();
		}
		for (const marker of this.markers) {
			marker.destroy();
		}
		this.foldManager.destroy();
	}

	/***************************************************************************
	 * Methods for an opener
	 **************************************************************************/

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

	async insertLogs(logs: GitLog[]): Promise<Boolean> {
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
		return true;
	}

	/***************************************************************************
	 * Status Headers Section
	 **************************************************************************/

	async insertHeadBranchHeader(branch: String = null): Promise<Boolean> {
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
		return true;
	}

	async insertUpstreamBranchHeader(branch: String = null): Promise<Boolean> {
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
		return true;
	}

	async insertPushBranchHeader(): Promise<Boolean> {
		const push = await this.git.getPushBranch();
		if (push.length > 0) {
			const gitLog = await this.git.getLog(push);
			const subject = gitLog.getSubject();
			const msg = (subject.length > 0) ? subject : '(no commit message)';
			this.insertText('Push:'.padEnd(10), GIT_STATUS_COLORS['head']);
			this.insertText(` ${push}`, GIT_STATUS_COLORS['remote']);
			this.insertText(` ${msg}\n`, GIT_STATUS_COLORS['subject']);
		}
		return true;
	}

	async insertTagsHeader(): Promise<Boolean> {
		const currTag = await this.git.getCurrTag();
		const nextTag = await this.git.getNextTag();
		if (currTag.name === nextTag.name) {
			nextTag.name = '';
		}
		console.log(currTag, nextTag);
		const bothTag = (currTag.name.length > 0 && nextTag.name.length > 0);
		if (currTag.name.length <= 0 && nextTag.name.length <= 0) {
			return true;
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
		return true;
	}

	async insertStatusHeaders(): Promise<Boolean> {
		if (!await this.git.getSymVerify('HEAD')) {
			this.insertText('In the beginning there was darkness\n', GIT_STATUS_COLORS['subject']);
			return false;
		}
		const branch = await this.git.getCurrentBranch();

		// Section Title
		await this.insertHeadBranchHeader(branch);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		await this.insertUpstreamBranchHeader(branch);
		await this.insertPushBranchHeader();
		await this.insertTagsHeader();
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Merge Section
	 **************************************************************************/

	async insertMergeLog(): Promise<Boolean> {
		if (!this.git.mergeInProgress()) {
			return true;
		}
		const mergeHead = this.git.getMergeHead();
		const hash = await this.git.getSymRev(mergeHead);
		const logs = await this.git.getLogs([`HEAD..${hash}`]);
		if (logs.length > 0) {
			this.insertText('\n');

			// Section Title
			this.insertText(`Merging ${hash}`, GIT_STATUS_COLORS['section']);
			this.insertText(` (${logs.length})\n`, GIT_STATUS_COLORS['subject']);
			const startPoint = this.getPrevLinePoint();

			// Section Contents
			this.insertLogs(logs);
			const endPoint = this.getCurrentPoint();
			const range = new Range(startPoint, endPoint);
			this.foldManager.add(range);
		}
		return true;
	}

	/***************************************************************************
	 * Rebase Section
	 **************************************************************************/

	async insertRebaseMergeSeq(): Promise<Boolean> {
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

		return true;
	}

	async insertRebaseApplySeq(): Promise<Boolean> {
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

		return true;
	}

	async insertRebaseSeq(): Promise<Boolean> {
		if (!this.git.rebaseInProgress()) {
			return true;
		}
		const headName = this.git.getRebaseHeadName();
		const onto = this.git.getRebaseOnto();
		const ontoName = await this.git.getRevName(onto);
		this.insertText('\n');

		// Section Title
		this.insertText(`Rebasing ${headName} onto ${ontoName}\n`, GIT_STATUS_COLORS['section']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
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
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Apply Section
	 **************************************************************************/

	async insertApplySeq(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * Sequence Section
	 **************************************************************************/

	async insertSeqSeq(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * Bisect Output Section
	 **************************************************************************/

	async insertBisectOutput(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * Bisect Rest Section
	 **************************************************************************/

	async insertBisectRest(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * Bisect Log Section
	 **************************************************************************/

	async insertBisectLog(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * Untracked Files Section
	 **************************************************************************/

	async insertUntrackedFiles(): Promise<Boolean> {
		const untrackedFiles = await this.git.getUntrackedFiles();
		if (untrackedFiles.length <= 0) {
			return true;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Untracked files', GIT_STATUS_COLORS['section']);
		this.insertText(` (${untrackedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		for (const file of untrackedFiles) {
			this.insertText(`${file}\n`, GIT_STATUS_COLORS['subject']);
		}
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Unstaged Changes Section
	 **************************************************************************/

	async insertUnstagedChanges(): Promise<Boolean> {
		const unstagedFiles = await this.git.getUnstagedFiles();
		if (unstagedFiles.length <= 0) {
			return true;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Unstaged changes', GIT_STATUS_COLORS['section']);
		this.insertText(` (${unstagedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		for (const file of unstagedFiles) {
			this.insertText(`modified   ${file}\n`, GIT_STATUS_COLORS['subject']);
			const startPoint = this.getPrevLinePoint();
			const diff = await this.git.getUnstagedDiffFile(file);
			const hunks = diff.getHunks();
			for (const hunk of hunks) {
				this.insertText(`${hunk.getHead()}\n`, GIT_STATUS_COLORS['hash']);
				const startPoint = this.getPrevLinePoint();
				for (const line of hunk.getBody()) {
					let color = 'hash';
					if (line.startsWith('+')) {
						color = 'remote';
					} else if (line.startsWith('-')) {
						color = 'local';
					}
					this.insertText(`${line}\n`, GIT_STATUS_COLORS[color]);
				}
				const endPoint = this.getPrevLinePoint();
				const range = new Range(startPoint, endPoint);
				this.foldManager.add(range);
			}
			const endPoint = this.getPrevLinePoint();
			const range = new Range(startPoint, endPoint);
			this.foldManager.add(range);
		}
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Staged Changes Section
	 **************************************************************************/

	async insertStagedChanges(): Promise<Boolean> {
		const stagedFiles = await this.git.getStagedFiles();
		if (stagedFiles.length <= 0) {
			return true;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Staged changes', GIT_STATUS_COLORS['section']);
		this.insertText(` (${stagedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		for (const file of stagedFiles) {
			this.insertText(`modified   ${file}\n`, GIT_STATUS_COLORS['subject']);
			const startPoint = this.getPrevLinePoint();
			const diff = await this.git.getStagedDiffFile(file);
			const hunks = diff.getHunks();
			for (const hunk of hunks) {
				this.insertText(`${hunk.getHead()}\n`, GIT_STATUS_COLORS['hash']);
				const startPoint = this.getPrevLinePoint();
				for (const line of hunk.getBody()) {
					let color = 'hash';
					if (line.startsWith('+')) {
						color = 'remote';
					} else if (line.startsWith('-')) {
						color = 'local';
					}
					this.insertText(`${line}\n`, GIT_STATUS_COLORS[color]);
				}
				const endPoint = this.getPrevLinePoint();
				const range = new Range(startPoint, endPoint);
				this.foldManager.add(range);
			}
			const endPoint = this.getPrevLinePoint();
			const range = new Range(startPoint, endPoint);
			this.foldManager.add(range);
		}
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Stashes Section
	 **************************************************************************/

	async insertStashes(): Promise<Boolean> {
		const stashes = await this.git.getStashes();
		if (stashes.length <= 0) {
			return true;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Stashes', GIT_STATUS_COLORS['section']);
		this.insertText(` (${stashes.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		for (const stash of stashes) {
			this.insertText(`stash@{${stash.getID()}}`, GIT_STATUS_COLORS['hash']);
			this.insertText(` ${stash.getSubject()}\n`, GIT_STATUS_COLORS['subject']);
		}
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Unpushed to Push Remote Section
	 **************************************************************************/

	async insertUnpushedToPushremote(): Promise<Boolean> {
		const pushBranch = await this.git.getPushBranch();
		if (pushBranch.length <= 0) {
			return true;
		}
		const unpushedLogs = await this.git.getLogs([`${pushBranch}..`]);
		if (unpushedLogs.length <= 0) {
			return true;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Unpushed to', GIT_STATUS_COLORS['section']);
		this.insertText(` ${pushBranch}`, GIT_STATUS_COLORS['remote']);
		this.insertText(` (${unpushedLogs.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		this.insertLogs(unpushedLogs);
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Unpushed to Upstream or Recent Section
	 **************************************************************************/

	async insertUnpushedToUpstreamOrRecent(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * Unpulled from Push Remote Section
	 **************************************************************************/

	async insertUnpulledFromPushremote(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * Unpulled from Upstream Section
	 **************************************************************************/

	async insertUnpulledFromUpstream(): Promise<Boolean> {
		return true;
	}

	/***************************************************************************
	 * TODO: Temp Method
	 **************************************************************************/

	async insertStatus() {
		this.gitStatus = await this.git.getStatus();
	}

	/***************************************************************************
	 * Update Sections
	 **************************************************************************/

	async update() {
		this.gutter.show();
		this.setText('');

		const statusSections = [
			this.insertStatusHeaders.bind(this),
			this.insertMergeLog.bind(this),
			this.insertRebaseSeq.bind(this),
			this.insertApplySeq.bind(this),
			this.insertSeqSeq.bind(this),
			this.insertBisectOutput.bind(this),
			this.insertBisectRest.bind(this),
			this.insertBisectLog.bind(this),
			this.insertUntrackedFiles.bind(this),
			this.insertUnstagedChanges.bind(this),
			this.insertStagedChanges.bind(this),
			this.insertStashes.bind(this),
			this.insertUnpushedToPushremote.bind(this),
			this.insertUnpushedToUpstreamOrRecent.bind(this),
			this.insertUnpulledFromPushremote.bind(this),
			this.insertUnpulledFromUpstream.bind(this)
		];

		for (const section of statusSections) {
			if (!await section()) {
				return;
			}
		}

		// Status
		await this.insertStatus();

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

				// Section Title
				this.insertText('Recent commits\n', GIT_STATUS_COLORS['section']);
				const startPoint = this.getPrevLinePoint();

				// Section Contents
				this.insertLogs(logs);
				const endPoint = this.getCurrentPoint();
				const range = new Range(startPoint, endPoint);
				this.foldManager.add(range);
			}
		}

		this.editor.setCursorBufferPosition([0, 0]);
	}
}
