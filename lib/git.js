'use babel';

import * as cp from 'child_process';
import * as rl from 'readline';
import Log from './log';
import GitStatus from './git-status';
import GitLog from './git-log';
import GitStash from './git-stash';

export default class Git {
	cwd: String;

	constructor(cwd: String) {
		this.cwd = cwd;
	}

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

	async getStatus(): Promise<GitStatus> {
		let gitStatus = new GitStatus();
		return this.executeAppend('git', ['status'], gitStatus);
	}

	async getLogs(args: String[]): Promise<GitLog[]> {
		let gitLog = new GitLog();
		return this.executeLine('git', ['log', '--oneline', '--decorate=full'].concat(args), gitLog);
	}

	async getLog(ref: String): Promise<GitLog> {
		const line = await this.execute('git', ['log', '--oneline', '--decorate=full', '-1', ref]);
		return GitLog.create(line);
	}

	async getConfig(key: String): Promise<String> {
		return this.execute('git', ['config', '-z', '--get-all', key]);
	}

	async getCurrentBranch(): Promise<String> {
		return this.execute('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
	}

	async getUpstream(): Promise<String> {
		return this.execute('git', ['rev-parse', '--abbrev-ref', '@{u}']);
	}

	async getTag(): Promise<String> {
		return this.execute('git', ['describe', '--tag', '--long'], true);
	}

	async getStashes(args: String[]): Promise<GitStash[]> {
		let gitStash = new GitStash();
		return this.executeLine('git', ['stash', 'list'].concat(args), gitStash);
	}
}
