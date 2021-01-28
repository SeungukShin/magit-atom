'use babel';

import { Range } from 'atom';
import { MagitTextEditor } from './magit-text-editor';
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

export default class MagitStatus extends MagitTextEditor {
	constructor(cwd: String) {
		super(cwd);
		this.keybindings = [
			{
				sectionName: 'Transient add dwim commands',
				keyDescriptions: [
					[
						{ key: 'A', desc: 'Apply', cb: 'unset!' },
						{ key: 'b', desc: 'Branch', cb: 'unset!' },
						{ key: 'B', desc: 'Bisect', cb: 'unset!' },
						{ key: 'c', desc: 'Commit', cb: 'unset!' },
						{ key: 'C', desc: 'Clone', cb: 'unset!' },
						{ key: 'd', desc: 'Diff', cb: 'unset!' },
						{ key: 'D', desc: 'Diff (change)', cb: 'unset!' },
						{ key: 'e', desc: 'Ediff (dwim)', cb: 'unset!' },
						{ key: 'E', desc: 'Ediff', cb: 'unset!' }
					],
					[
						{ key: 'f', desc: 'Fetch', cb: 'unset!' },
						{ key: 'F', desc: 'Pull', cb: 'unset!' },
						{ key: 'l', desc: 'Log', cb: 'unset!' },
						{ key: 'L', desc: 'Log (change)', cb: 'unset!' },
						{ key: 'm', desc: 'Merge', cb: 'unset!' },
						{ key: 'M', desc: 'Remote', cb: 'unset!' },
						{ key: 'o', desc: 'Submodule', cb: 'unset!' },
						{ key: 'O', desc: 'Subtree', cb: 'unset!' }
					],
					[
						{ key: 'P', desc: 'Push', cb: 'unset!' },
						{ key: 'r', desc: 'Rebase', cb: 'unset!' },
						{ key: 't', desc: 'Tag', cb: 'unset!' },
						{ key: 'T', desc: 'Note', cb: 'unset!' },
						{ key: 'V', desc: 'Revert', cb: 'unset!' },
						{ key: 'w', desc: 'Apply patches', cb: 'unset!' },
						{ key: 'W', desc: 'Format patches', cb: 'unset!' },
						{ key: 'X', desc: 'Reset', cb: 'unset!' }
					],
					[
						{ key: 'y', desc: 'Show Refs', cb: 'unset!' },
						{ key: 'Y', desc: 'Cherries', cb: 'unset!' },
						{ key: 'z', desc: 'Stash', cb: 'unset!' },
						{ key: '!', desc: 'Run', cb: 'unset!' },
						{ key: '%', desc: 'Worktree', cb: 'unset!' }
					]
				]
			},
			{
				sectionName: 'Applying changes',
				keyDescriptions: [
					[
						{ key: 'a', desc: 'Apply', cb: 'unset!' },
						{ key: 'v', desc: 'Reverse', cb: 'unset!' },
						{ key: 'k', desc: 'Discard', cb: 'unset!' }
					],
					[
						{ key: 's', desc: 'Stage', cb: 'unset!' },
						{ key: 'u', desc: 'Unstage', cb: 'unset!' },
					],
					[
						{ key: 'S', desc: 'Stage all', cb: 'unset!' },
						{ key: 'U', desc: 'Unstage all', cb: 'unset!' },
					]
				]
			},
			{
				sectionName: 'Essential commands',
				keyDescriptions: [
					[
						{ key: 'g', desc: 'refresh current buffer', cb: 'magit-atom:update-status' },
						{ key: 'tab', desc: 'toggle section at point', cb: 'magit-atom:toggle-fold' },
						{ key: 'enter', desc: 'visit thing at point', cb: 'unset!' },
						{ key: 'h', desc: 'show all key bindings', cb: 'magit-atom:popup' }
					]
				]
			},
			{
				sectionName: ' Hidden commands',
				keyDescriptions: [
					[
						{ key: 'n', desc: 'previous line', cb: 'core:move-up' },
						{ key: 'p', desc: 'next line', cb: 'core:move-down' },
						{ key: 'q', desc: 'cancel', cb: 'core:cancel' }
					]
				]
			}
		];
		this.bindKey();
	}

	/***************************************************************************
	 * Methods for messages
	 **************************************************************************/

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
			this.insertText(` ${nextTag.name}`, GIT_STATUS_COLORS['tag']);
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
		const upstreamBranch = await this.git.getUpstreamBranch();
		const pushBranch = await this.git.getPushBranch();

		// Section Title
		await this.insertHeadBranchHeader(branch);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		await this.insertUpstreamBranchHeader(branch);
		if (upstreamBranch !== pushBranch) {
			await this.insertPushBranchHeader();
		}
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
			this.foldManager.toggle(startPoint.row);
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
			this.foldManager.toggle(startPoint.row);
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
		const upstreamBranch = await this.git.getUpstreamBranch();
		if (pushBranch === upstreamBranch) {
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

	async insertUnpushedToUpstream(): Promise<Boolean> {
		const upstreamBranch = await this.git.getUpstreamBranch();
		if (upstreamBranch.length <= 0) {
			return false;
		}
		const unmergedLogs = await this.git.getLogs([`${upstreamBranch}..`]);
		if (unmergedLogs.length <= 0) {
			return false;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Unmerged into', GIT_STATUS_COLORS['section']);
		this.insertText(` ${upstreamBranch}`, GIT_STATUS_COLORS['remote']);
		this.insertText(` (${unmergedLogs.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		this.insertLogs(unmergedLogs);
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	async insertRecentCommits(): Promise<Boolean> {
		const recentLogs = await this.git.getLogs(['-10']);
		if (recentLogs.length <= 0) {
			return false;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Recent commits\n', GIT_STATUS_COLORS['section']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		this.insertLogs(recentLogs);
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	async insertUnpushedToUpstreamOrRecent(): Promise<Boolean> {
		if (!await this.insertUnpushedToUpstream()) {
			await this.insertRecentCommits();
		}
		return true;
	}

	/***************************************************************************
	 * Unpulled from Push Remote Section
	 **************************************************************************/

	async insertUnpulledFromPushremote(): Promise<Boolean> {
		const pushBranch = await this.git.getPushBranch();
		if (pushBranch.length <= 0) {
			return true;
		}
		const upstreamBranch = await this.git.getUpstreamBranch();
		if (pushBranch === upstreamBranch) {
			return true;
		}
		const unpulledLogs = await this.git.getLogs([`..${pushBranch}`]);
		if (unpulledLogs.length <= 0) {
			return true;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Unpulled from', GIT_STATUS_COLORS['section']);
		this.insertText(` ${pushBranch}`, GIT_STATUS_COLORS['remote']);
		this.insertText(` (${unpulledLogs.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		this.insertLogs(unpulledLogs);
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
	}

	/***************************************************************************
	 * Unpulled from Upstream Section
	 **************************************************************************/

	async insertUnpulledFromUpstream(): Promise<Boolean> {
		const upstreamBranch = await this.git.getUpstreamBranch();
		if (upstreamBranch.length <= 0) {
			return true;
		}
		const unpulledLogs = await this.git.getLogs([`..${upstreamBranch}`]);
		if (unpulledLogs.length <= 0) {
			return true;
		}
		this.insertText('\n');

		// Section Title
		this.insertText('Unpulled from', GIT_STATUS_COLORS['section']);
		this.insertText(` ${upstreamBranch}`, GIT_STATUS_COLORS['remote']);
		this.insertText(` (${unpulledLogs.length})\n`, GIT_STATUS_COLORS['subject']);
		const startPoint = this.getPrevLinePoint();

		// Section Contents
		this.insertLogs(unpulledLogs);
		const endPoint = this.getCurrentPoint();
		const range = new Range(startPoint, endPoint);
		this.foldManager.add(range);

		return true;
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

		this.editor.setCursorBufferPosition([0, 0]);
	}
}
