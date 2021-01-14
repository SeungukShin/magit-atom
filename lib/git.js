'use babel';

import * as cp from 'child_process';
import * as rl from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import Log from './log';
import GitStatus from './git-status';
import GitLog from './git-log';
import GitStash from './git-stash';

export class GitTag {
	name: String;
	dist: Number;

	constructor(name: String = '', dist: Number = 0) {
		this.name = name;
		this.dist = dist;
	}
}

export class GitSeqLog {
	act: String;
	hash: String;
	subject: String;

	constructor(act: String, hash: String, subject: String) {
		this.act = act;
		this.hash = hash;
		this.subject = subject;
	}
}

export class GitPairLog {
	oldItem: String;
	newItem: String;

	constructor(oldItem: String, newItem: String) {
		this.oldItem = oldItem;
		this.newItem = newItem;
	}
}

export default class Git {
	cwd: String;

	constructor(cwd: String) {
		this.cwd = cwd;
	}

	/***************************************************************************
	 * Base execution functions
	 **************************************************************************/

	// executes @cmd with @args and concatenates outputs and returns it.
	async execute(cmd: String, args: String[], ignoreError: Boolean = false): Promise<String> {
		return new Promise((resolve, reject) => {
			Log.info(cmd, args, this.cwd);
			let out = '';
			let err = '';
			const proc = cp.spawn(cmd, args, { cwd: this.cwd });
			proc.stdout.on('data', (data) => {
				out = out.concat(data.toString());
			});
			proc.stderr.on('data', (data) => {
				err = err.concat(data.toString());
			});
			proc.on('error', (error) => {
				Log.err('error:', error);
				if (!ignoreError) {
					reject(error.toString().trim());
				}
			});
			proc.on('close', (code) => {
				if (err.length > 0) {
					Log.err(`stderr: ${code}\n${err}`);
				}
				Log.info(`stdout: ${code}\n${out}`);
				if (code != 0 && !ignoreError) {
					reject(err.trim());
				} else {
					resolve(out.trim());
				}
			});
		});
	}

	// executes @cmd with @args and parses outputs with @obj and returns it.
	// @obj should have the method for parsing - 'append(line: String)'
	async executeAppend(cmd: String, args: String[], obj: any): Promise {
		return new Promise((resolve, reject) => {
			Log.info(cmd, args, this.cwd, obj);
			let out = '';
			let err = '';
			const proc = cp.spawn(cmd, args, { cwd: this.cwd });
			const rline = rl.createInterface({ input: proc.stdout, terminal: false});
			rline.on('line', (line) => {
				obj.append(line);
				out = out.concat(line);
			});
			proc.stderr.on('data', (data) => {
				err = err.concat(data.toString());
			});
			proc.on('error', (error) => {
				Log.err('error:', error);
				reject(error.toString().trim());
			});
			proc.on('close', (code) => {
				if (err.length > 0) {
					Log.err(`stderr: ${code}\n${err}`);
				}
				Log.info(`stdout: ${code}\n${out}`);
				if (code != 0) {
					reject(err.trim());
				} else {
					Log.info('result:', obj);
					resolve(obj);
				}
			});
		});
	}

	// executes @cmd with @args and parses line by line with @obj and returns them.
	// @obj should have the static to create new instance - 'create(line: String)'
	async executeLine(cmd: String, args: String[], obj: any): Promise {
		return new Promise((resolve, reject) => {
			Log.info(cmd, args, this.cwd, obj);
			let results = [];
			let out = '';
			let err = '';
			const proc = cp.spawn(cmd, args, { cwd: this.cwd });
			const rline = rl.createInterface({ input: proc.stdout, terminal: false});
			rline.on('line', (line) => {
				results.push(obj.constructor.create(line));
				out = out.concat(line);
			});
			proc.stderr.on('data', (data) => {
				err = err.concat(data.toString());
			});
			proc.on('error', (error) => {
				Log.err('error:', error);
				reject(error.toString().trim());
			});
			proc.on('close', (code) => {
				if (err.length > 0) {
					Log.err(`stderr: ${code}\n${err}`);
				}
				Log.info(`stdout: ${code}\n${out}`);
				if (code != 0) {
					reject(err.trim());
				} else {
					Log.info('result:', results);
					resolve(results);
				}
			});
		});
	}

	/***************************************************************************
	 * Base git commands
	 **************************************************************************/

	 // get git version
	 // @return: x.y.z -> [x, y, z]
	async getVersion(): Promise<Number[]> {
		return new Promise(async (resolve, reject) => {
			const line = await this.execute('git', ['version']);
			if (line.length <= 0) {
				reject();
				return;
			}
			const list = line.split(' ');
			if (list.length < 3) {
				reject();
				return;
			}
			const version = list[2].split('.');
			if (version.length < 3) {
				reject();
				return;
			}
			resolve(version);
		});
	}

	// get an option value for a @key
	// @key: option key
	// @return: option value
	async getConfig(key: String): Promise<String> {
		return this.execute('git', ['config', '--get-all', key], true);
	}

	// get a symbolic name for a @rev (revision)
	// @rev: revision (hash)
	// @return: symbolic name
	async getRevName(rev: String): Promise<String> {
		return this.execute('git', ['name-rev', '--name-only', '--no-undefined', rev], true);
	}

	// get a symbolic name for @ref (symbolic reference)
	// @ref: symbolic reference
	// @return: symboic name
	async getRefName(ref: String): Promise<String> {
		return this.execute('git', ['symbolic-ref', '--short', ref], true);
	}

	// get a revision for @sym (symbolic name, reference or revision)
	// @sym: symbolic name, reference or revision
	// @return: revision (hash)
	async getSymRev(sym: String): Promise<String> {
		return this.execute('git', ['rev-parse', '--short', sym], true);
	}

	// get a symbolic name for @sym (symbolic name, reference or revision)
	// @sym: symbolic name, reference or revision
	// @return: symbolic name
	async getSymName(sym: String): Promise<String> {
		return this.execute('git', ['rev-parse', '--abbrev-ref', sym], true);
	}

	/***************************************************************************
	 * Git commands related to branch
	 **************************************************************************/

	// get the current local branch
	// @return: symboic name of the current branch
	async getCurrentBranch(): Promise<String> {
		return this.getRefName('HEAD');
	}

	// get the upstream branch
	// @return: symbolic name of the upstream branch
	async getUpstreamBranch(): Promise<String> {
		return this.getSymName('@{u}');
	}

	// get the push branch
	// @return: symbolic name of the push branch
	async getPushBranch(): Promise<String> {
		return this.getSymName('@{push}');
	}

	// get the remote repository name for @branch
	// @branch: a local branch name (the current branch is used if this is null)
	// @return: a remote repository name
	async getRemote(branch: String = null): Promise<String> {
		if (!branch) {
			branch = await this.getCurrentBranch();
		}
		return this.getConfig(`branch.${branch}.remote`);
	}

	// get the merge branch name for @branch
	// @branch: a local branch name (the current branch is used if this is null)
	// @return: a merge branch name
	async getMerge(branch: String = null): Promise<String> {
		if (!branch) {
			branch = await this.getCurrentBranch();
		}
		return this.getConfig(`branch.${branch}.merge`);
	}

	// get the rebase branch name for @branch
	// @branch: a local branch name (the current branch is used if this is null)
	// @return: a rebase branch name
	async getRebase(branch: String = null): Promise<String> {
		if (!branch) {
			branch = await this.getCurrentBranch();
		}
		return this.getConfig(`branch.${branch}.rebase`);
	}

	/***************************************************************************
	 * Git commands related to tag
	 **************************************************************************/

	// get the nearest tag and distance backward
	// @return: .name: tag name
	//          .dist: distance from HEAD
	async getCurrTag(): Promise<GitTag> {
		const line = await this.execute('git', ['describe', '--tags', '--long'], true);
		if (line.length <= 0) {
			return new GitTag();
		}
		const tokens = line.split('-');
		if (tokens.length < 2) {
			return new GitTag(line);
		}
		return new GitTag(tokens[0], parseInt(tokens[1]));
	}

	// get the nearest tag and distance forward
	// @return: .name: tag name
	//          .dist: distance from HEAD
	async getNextTag(): Promise<GitTag> {
		const line = await this.execute('git', ['describe', '--contains', '--long'], true);
		if (line.length <= 0) {
			return new GitTag();
		}
		const tokens = line.split('~');
		if (tokens.length < 2) {
			return new GitTag(line);
		}
		return new GitTag(tokens[0], parseInt(tokens[1]));
	}

	/***************************************************************************
	 * Git commands related to sequence
	 **************************************************************************/

	// get a line from a @file
	// @file: a file to read
	// @return: ths first line of the @file
	getLine(file: String): String {
		if (!fs.existsSync(file)) {
			return '';
		}
		const lines = fs.readFileSync(file, 'utf8');
		return lines.split('\n')[0];
	}

	// get all line from a @file except empty lines
	// @file: a file to read
	// @return: array of line of the @file
	getLines(file: String): String[] {
		const results = [];
		if (!fs.existsSync(file)) {
			return results;
		}
		const lines = fs.readFileSync(file, 'utf8');
		for (const line of lines.split('\n')) {
			if (line.length <= 0) {
				continue;
			}
			results.push(line);
		}
		return results;
	}

	// get all pair item from a @file using @sep
	// @file: a file to read
	// @return: array of pair item of the @file
	getPairs(file: String, sep: String = ' '): GitPairLog[] {
		const results = [];
		if (!fs.existsSync(file)) {
			return results;
		}
		const lines = fs.readFileSync(file, 'utf8');
		for (const line of lines.split('\n')) {
			if (line.length <= 0) {
				continue;
			}
			items = line.split(sep);
			if (items.length < 2) {
				continue;
			}
			results.push(new GitPairLog(items[0], items[1]));
		}
		return results;
	}

	// get sequence logs from a @file except comment or empty lines
	// @file: a file to read
	// @return: array of sequence log
	getSeqLogs(file: String): GitSeqLog[] {
		const results = [];
		if (!fs.existsSync(file)) {
			return results;
		}
		const lines = fs.readFileSync(file, 'utf8');
		for (const line of lines.split('\n')) {
			if (line.startsWith('#') || line.length <= 0) {
				continue;
			}
			const actEnd = line.indexOf(' ');
			const hashEnd = line.indexOf(' ', actEnd + 1);
			results.push(new GitSeqLog(
				line.substring(0, actEnd),
				line.substring(actEnd + 1, hashEnd),
				line.substring(hashEnd + 1)
			));
		}
		return results;
	}

	/***************************************************************************
	 * Git commands related to merge
	 **************************************************************************/

	/***************************************************************************
	 * Git commands related to rebase
	 **************************************************************************/

	// check whether rebase is on going or not
	// @return: true if rebase is on going or false
	rebaseMergeInProgress(): Boolean {
		const file = path.join(this.cwd, '.git', 'rebase-merge');
		return fs.existsSync(file);
	}

	// check whether rebase with applying strategies is on going or not
	// @return: true if rebase is on going or false
	rebaseApplyInProgress(): Boolean {
		const file = path.join(this.cwd, '.git', 'rebase-apply', 'onto');
		return fs.existsSync(file);
	}

	// check whether rebase is on going or not
	// @return: true if rebase is on going or false
	rebaseInProgress(): Boolean {
		return this.rebaseMergeInProgress() || this.rebaseApplyInProgress();
	}

	// get rebase head name
	// @return rebase head name
	getRebaseHeadName(): String {
		const fileMerge = path.join(this.cwd, '.git', 'rebase-merge');
		const fileApply = path.join(this.cwd, '.git', 'rebase-apply');
		let baseDir = '';
		if (fs.existsSync(fileMerge)) {
			baseDir = fileMerge;
		} else if (fs.existsSync(fileApply)) {
			baseDir = fileApply;
		} else {
			return '';
		}
		const file = path.join(baseDir, 'head-name');
		return this.getLine(file);
	}

	// get rebase onto revision (hash)
	// @return: rebase onto revision (hash)
	getRebaseOnto(): String {
		const fileMerge = path.join(this.cwd, '.git', 'rebase-merge');
		const fileApply = path.join(this.cwd, '.git', 'rebase-apply');
		let baseDir = '';
		if (fs.existsSync(fileMerge)) {
			baseDir = fileMerge;
		} else if (fs.existsSync(fileApply)) {
			baseDir = fileApply;
		} else {
			return '';
		}
		const file = path.join(baseDir, 'onto');
		return this.getLine(file);
	}

	// get rebase todo logs
	// @return: rebase todo logs
	getRebaseMergeTodo(): GitSeqLog[] {
		const file = path.join(this.cwd, '.git', 'rebase-merge', 'git-rebase-todo');
		return this.getSeqLogs(file);
	}

	// get rebase done logs
	// @return: rebase done logs
	getRebaseMergeDone(): GitSeqLog[] {
		const file = path.join(this.cwd, '.git', 'rebase-merge', 'done');
		return this.getSeqLogs(file);
	}

	// get rebase stop revision (hash)
	// @return: rebase stop revision
	getRebaseMergeStop(): String {
		const file = path.join(this.cwd, '.git', 'rebase-merge', 'stopped-sha');
		return this.getLine(file);
	}

	// get rebase rewritten revisions (hashes)
	// @return: rebase rewritten revisions
	getRebaseApplyRewrittens(): GitPairLog[] {
		const file = path.join(this.cwd, '.git', 'rebase-apply', 'rewritten');
		return this.getPairs(file);
	}

	// get rebase rewritten revisions (hashes)
	// @return: rebase rewritten revisions
	getRebaseApplyOriginalCommit(): String {
		const file = path.join(this.cwd, '.git', 'rebase-apply', 'original-commit');
		return this.getLine(file);
	}















	mergeInProgress(): Boolean {
		const file = path.join(this.cwd, '.git', 'MERGE_HEAD');
		return fs.existsSync(file);
	}

	getMergeHead(): String {
		const file = path.join(this.cwd, '.git', 'MERGE_HEAD');
		const lines = fs.readFileSync(file, 'utf8');
		return lines.split('\n')[0];
	}







	async getLog(ref: String): Promise<GitLog> {
		const line = await this.execute('git', ['log', '--oneline', '--decorate=full', '-1', ref]);
		return GitLog.create(line);
	}

	async getLogs(args: String[]): Promise<GitLog[]> {
		let gitLog = new GitLog();
		if (args.length <= 0) {
			args = ['log', '--oneline', '--decorate=full'];
		} else {
			args = ['log', '--oneline', '--decorate=full'].concat(args)
		}
		return this.executeLine('git', args, gitLog);
	}




	async getStatus(): Promise<GitStatus> {
		let gitStatus = new GitStatus();
		return this.executeAppend('git', ['status'], gitStatus);
	}

	async getStashes(): Promise<GitStash[]> {
		let gitStash = new GitStash();
		return this.executeLine('git', ['stash', 'list'], gitStash);
	}
}
