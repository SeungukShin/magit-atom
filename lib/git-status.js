'use babel';

import Log from './log';

class TrackedFile {
	status: String;
	file: String;

	constructor(status: String, file: String) {
		this.status = status;
		this.file = file;
	}
}

const GitStatusState = {
	'branch': 'On branch',
	'update': 'Your branch',
	'staged': 'Changes to be committed:',
	'unstaged': 'Changes not staged for commit:',
	'untracked': 'Untracked files:'
};

const RemoteBranchOffset = {
	'up to date': 31,
	'behind': 22,
	'ahead': 24,
	'diverged': 16
}

export default class GitStatus {
	state: String;
	currentBranch: String;
	remoteBranch: String;
	behindCommit: Number;
	aheadCommit: Number;
	stagedFiles: TrackedFile[];
	unstagedFiles: TrackedFile[];
	untrackedFiles: String[];

	constructor() {
		this.state = '';
		this.currentBranch = '';
		this.remoteBranch = '';
		this.behindCommit = -1;
		this.aheadCommit = -1;
		this.stagedFiles = [];
		this.unstagedFiles = [];
		this.untrackedFiles = [];
	}

	getCurrentBranch(): String {
		return this.currentBranch;
	}

	getRemoteBranch(): String {
		return this.remoteBranch;
	}

	getCommitCounts(): [Number, Number] {
		return [this.behindCommit, this.aheadCommit];
	}

	getStagedFiles(): TrackedFile[] {
		return this.stagedFiles;
	}

	getUnstagedFiles(): TrackedFile[] {
		return this.unstagedFiles;
	}

	getUntrackedFiles(): String[] {
		return this.untrackedFiles;
	}

	append(line: String): void {
		for (const [key, value] of Object.entries(GitStatusState)) {
			if (line.startsWith(value)) {
				Log.info(`state: ${this.state} -> ${key}`);
				this.state = key;
				break;
			}
		}
		switch (this.state) {
			case 'branch':
				if (line.startsWith('On branch')) {
					this.currentBranch = line.substring(10);
					Log.info(`current branch: ${this.currentBranch}`);
				}
				break;
			case 'update':
				if (line.startsWith('Your branch')) {
					const start = line.indexOf('\'');
					const end = line.indexOf('\'', start + 1);
					this.remoteBranch = line.substring(start + 1, end);
					Log.info(`remote branch: ${this.remoteBranch}`);

					switch (start) {
						case RemoteBranchOffset['up to date']:
							this.behindCommit = 0;
							this.aheadCommit = 0;
							Log.info('up to date');
							break;
						case RemoteBranchOffset['behind']:
							const behindStart = line.indexOf('by');
							const behindEnd = line.indexOf('commit', behindStart);
							this.behindCommit = parseInt(line.substring(behindStart + 3, behindEnd - 1));
							this.aheadCommit = 0;
							Log.info(`behind ${this.behindCommit} commits`);
							break;
						case RemoteBranchOffset['ahead']:
							const aheadStart = line.indexOf('by');
							const aheadEnd = line.indexOf('commit', aheadStart);
							this.behindCommit = 0;
							this.aheadCommit = parseInt(line.substring(aheadStart + 3, aheadEnd - 1));
							Log.info(`ahead ${this.aheadCommit} commits`);
							break;
						case RemoteBranchOffset['diverged']:
						default:
							break;
					}
				} else if (this.behindCommit == -1 && this.aheadCommit == -1 && line.startsWith('and have')) {
					const aheadStart = 9;
					const aheadEnd = line.indexOf('and', aheadStart);
					this.aheadCommit = parseInt(line.substring(aheadStart, aheadEnd - 1));
					const behindStart = aheadEnd + 4;
					const behindEnd = line.indexOf('different', behindStart);
					this.behindCommit = parseInt(line.substring(behindStart, behindEnd - 1));
					Log.info(`diverged ${this.aheadCommit}, ${this.behindCommit} commits`);
				}
				break;
			case 'staged':
				if (line.startsWith('\t')) {
					const status = line.substring(1, line.indexOf(':'));
					const file = line.substring(13);
					const info = new TrackedFile(status, file);
					Log.info('staged:', info);
					this.stagedFiles.push(info);
				}
				break;
			case 'unstaged':
				if (line.startsWith('\t')) {
					const status = line.substring(1, line.indexOf(':'));
					const file = line.substring(13);
					const info = new TrackedFile(status, file);
					Log.info('unstaged:', info);
					this.unstagedFiles.push(info);
				}
				break;
			case 'untracked':
				if (line.startsWith('\t')) {
					const file = line.substring(1);
					Log.info('untracked:', file);
					this.untrackedFiles.push(file);
				}
				break;
			default:
				Log.warn('unknown state:', line);
				break;
		}
	}
}
