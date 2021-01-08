'use babel';

import Log from './log';
import Git from './git';
import GitStatus from './git-status';
import GitStash from './git-stash';
import GitLog from './git-log';
import MagitAtomView from './magit-atom-view';

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
	magitAtomView: MagitAtomView;

	constructor(cwd: String) {
		this.cwd = cwd;
		this.git = new Git(cwd);
		this.magitAtomView = new MagitAtomView();
	}

	destroy() {
		this.magitAtomView.hide();
		this.magitAtomView.destroy();
	}

	async insertSummary() {
		// Head
		const head = await this.git.getLog('HEAD');
		this.magitAtomView.insertText('Head:'.padEnd(10), GIT_STATUS_COLORS['head']);
		const locals = head.getLabels('locals');
		if (locals.length > 0) {
			for (const local of locals) {
				this.magitAtomView.insertText(` ${local}`, GIT_STATUS_COLORS['local']);
			}
		} else {
			const hash = head.getHash();
			this.magitAtomView.insertText(` ${hash}`, GIT_STATUS_COLORS['hash']);
		}
		const subject = head.getSubject();
		this.magitAtomView.insertText(` ${subject}\n`, GIT_STATUS_COLORS['subject']);

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
				this.magitAtomView.insertText(msg, GIT_STATUS_COLORS['head']);
				this.magitAtomView.insertText(` ${upstream}`, GIT_STATUS_COLORS['remote']);
				this.magitAtomView.insertText(` ${subject}\n`, GIT_STATUS_COLORS['subject']);
			}

			let remote = await this.git.getConfig(`branch.${local}.pushRemote`);
			if (remote.length <= 0) {
				remote = await this.git.getConfig('branch.pushDefault');
			}
			if (remote.length > 0) {
				const gitLog = await this.git.getLog(remote);
				const subject = gitLog.getSubject();
				this.magitAtomView.insertText('Push:'.padEnd(10), GIT_STATUS_COLORS['head']);
				this.magitAtomView.insertText(` ${remote}`, GIT_STATUS_COLORS['remote']);
				this.magitAtomView.insertText(` ${subject}\n`, GIT_STATUS_COLORS['subject']);
			}
		}

		// Tag
		const tag = await this.git.getTag();
		if (tag.length > 0) {
			this.magitAtomView.insertText('Tag:'.padEnd(10), GIT_STATUS_COLORS['head']);
			const list = tag.split('-');
			if (list.length > 1) {
				this.magitAtomView.insertText(` ${list[0]}`, GIT_STATUS_COLORS['tag']);
				this.magitAtomView.insertText(' (', GIT_STATUS_COLORS['subject']);
				this.magitAtomView.insertText(`${list[1]}`, GIT_STATUS_COLORS['local']);
				this.magitAtomView.insertText(')\n', GIT_STATUS_COLORS['subject']);
			} else {
				this.magitAtomView.insertText(` ${tag}\n`, GIT_STATUS_COLORS['tag']);
			}
		}
	}

	async insertStatus() {
		this.gitStatus = await this.git.getStatus();

		// Untracked files
		const untrackedFiles = this.gitStatus.getUntrackedFiles();
		if (untrackedFiles.length > 0) {
			this.magitAtomView.insertText('\n');
			this.magitAtomView.insertText('Untracked files', GIT_STATUS_COLORS['section']);
			this.magitAtomView.insertText(` (${untrackedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const file of untrackedFiles) {
				this.magitAtomView.insertText(`${file}\n`, GIT_STATUS_COLORS['subject']);
			}
		}

		// Unstaged changes
		const unstagedFiles = this.gitStatus.getUnstagedFiles();
		if (unstagedFiles.length > 0) {
			this.magitAtomView.insertText('\n');
			this.magitAtomView.insertText('Unstaged changes', GIT_STATUS_COLORS['section']);
			this.magitAtomView.insertText(` (${unstagedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const file of unstagedFiles) {
				this.magitAtomView.insertText(`${file.status}   ${file.file}\n`, GIT_STATUS_COLORS['subject']);
			}
		}

		// Staged changes
		const stagedFiles = this.gitStatus.getStagedFiles();
		if (stagedFiles.length > 0) {
			this.magitAtomView.insertText('\n');
			this.magitAtomView.insertText('Staged changes', GIT_STATUS_COLORS['section']);
			this.magitAtomView.insertText(` (${stagedFiles.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const file of stagedFiles) {
				this.magitAtomView.insertText(`${file.status}   ${file.file}\n`, GIT_STATUS_COLORS['subject']);
			}
		}
	}

	async insertLogs(logs: GitLog[]) {
		for (const log of logs) {
			this.magitAtomView.insertText(log.getHash(), GIT_STATUS_COLORS['hash']);
			const locals = log.getLabels('locals');
			for (const local of locals) {
				this.magitAtomView.insertText(' ');
				this.magitAtomView.insertText(local, GIT_STATUS_COLORS['local'], true);
			}
			const remotes = log.getLabels('remotes');
			for (const remote of remotes) {
				this.magitAtomView.insertText(` ${remote}`, GIT_STATUS_COLORS['remote']);
			}
			const tags = log.getLabels('tags');
			for (const tag of tags) {
				this.magitAtomView.insertText(` ${tag}`, GIT_STATUS_COLORS['tag']);
			}
			this.magitAtomView.insertText(` ${log.getSubject()}\n`, GIT_STATUS_COLORS['subject']);

		}
	}

	async show() {
		this.magitAtomView.show();
		this.visible = true;

		this.magitAtomView.setText('');

		// Summary
		await this.insertSummary();

		// Status
		await this.insertStatus();

		// Stashes
		const stashes = await this.git.getStashes();
		if (stashes.length > 0) {
			this.magitAtomView.insertText('\n');
			this.magitAtomView.insertText('Stashes', GIT_STATUS_COLORS['section']);
			this.magitAtomView.insertText(` (${stashes.length})\n`, GIT_STATUS_COLORS['subject']);
			for (const stash of stashes) {
				this.magitAtomView.insertText(`stash@{${stash.getID()}}`, GIT_STATUS_COLORS['hash']);
				this.magitAtomView.insertText(` ${stash.getSubject()}\n`, GIT_STATUS_COLORS['subject']);
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
				this.magitAtomView.insertText('\n');
				this.magitAtomView.insertText('Unmerged into', GIT_STATUS_COLORS['section']);
				this.magitAtomView.insertText(` ${remoteBranch}`, GIT_STATUS_COLORS['remote']);
				this.magitAtomView.insertText(` (${unmergedLogs.length})\n`, GIT_STATUS_COLORS['subject']);
				this.insertLogs(unmergedLogs);
			}

			// Unpulled commits
			const unpulledLogs = await this.git.getLogs([`${currentBranch}..${remoteBranch}`]);
			if (unpulledLogs.length > 0) {
				this.magitAtomView.insertText('\n');
				this.magitAtomView.insertText('Unpulled from', GIT_STATUS_COLORS['section']);
				this.magitAtomView.insertText(` ${remoteBranch}`, GIT_STATUS_COLORS['remote']);
				this.magitAtomView.insertText(` (${unpulledLogs.length})\n`, GIT_STATUS_COLORS['subject']);
				this.insertLogs(unpulledLogs);
			}
		} else {
			// Recent commits
			const logs = await this.git.getLogs(['-10']);
			if (logs.length > 0) {
				this.magitAtomView.insertText('\n');
				this.magitAtomView.insertText('Recent commits\n', GIT_STATUS_COLORS['section']);
				this.insertLogs(logs);
			}
		}

		this.magitAtomView.editor.scrollToBufferPosition([0, 0]);
	}
}
