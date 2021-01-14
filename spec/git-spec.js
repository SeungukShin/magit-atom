'use babel';

import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execute } from './execute';
import Git from '../lib/git';

describe('Git', () => {
	const home = process.cwd();
	let cwd: String;
	let remote: String;
	let local: String;
	let git: Git;
	let out;

	beforeEach(async () => {
		cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'magit-atom-'));

		// Create a remote repo.
		process.chdir(cwd);
		remote = path.join(cwd, 'remote');
		fs.mkdirSync(remote);
		process.chdir(remote);
		out = await execute('git', ['init', '--bare']);

		// Clone the remote repo to the local repo
		process.chdir(cwd);
		out = await execute('git', ['clone', remote, 'local']);

		// Change a directory
		local = path.join(cwd, 'local');
		process.chdir(local);
		git = new Git(local);
	});

	afterEach(async () => {
		process.chdir(home);
		//process.rmdirSync(cwd, { recursive: true });
		if (process.platform === 'win32') {
			out = await execute('rmdir', ['/Q', '/S', cwd]);
		} else {
			out = await execute('rm', ['-rf', cwd]);
		}
	});

	it('gets a version', async () => {
		const version = await git.getVersion();
		console.log(version);
		expect(version[0]).toBe('2');
		expect(version[1]).toBe('29');
		expect(version[2]).toBe('2');
	});

	it('gets a config', async () => {
		out = await execute('git', ['config', '--local', 'test.string', 'getTest']);

		const value = await git.getConfig('test.string');
		console.log(value);
		expect(value).toBe('getTest');
	});

	it('gets a current branch', async () => {
		const branch = await git.getCurrentBranch();
		console.log(branch);
		expect(branch).toBe('master');
	});

	it('gets an upstream branch', async () => {
		out = await execute('touch', ['test']);
		out = await execute('git', ['add', 'test']);
		out = await execute('git', ['commit', '-m', '"test commit"']);
		out = await execute('git', ['push']);

		const branch = await git.getUpstreamBranch();
		console.log(branch);
		expect(branch).toBe('origin/master');
	});

	it('gets a remote', async () => {
		const branch = await git.getCurrentBranch();
		const remote = await git.getRemote(branch);
		console.log(remote);
		expect(remote).toBe('origin');
	});

	it('gets tags', async () => {
		let tag;

		// 1 tag
		// head:   head
		// commit: test1
		// tag:    test1
		out = await execute('touch', ['test1']);
		out = await execute('git', ['add', 'test1']);
		out = await execute('git', ['commit', '-m', '"test1 commit"']);
		out = await execute('git', ['tag', 'test1']);

		tag = await git.getCurrTag();
		console.log(tag);
		expect(tag.name).toBe('test1');
		expect(tag.dist).toBe(0);

		// 2 tags -> only one tag is shown
		// head:   head
		// commit: test1
		// tag:    test1/test2
		out = await execute('git', ['tag', 'test2']);

		tag = await git.getCurrTag();
		console.log(tag);
		expect(tag.name).toBe('test1');
		expect(tag.dist).toBe(0);

		// distance to the current tag
		// head:                  head
		// commit: test1       -> test2
		// tag:    test1/test2
		out = await execute('touch', ['test2']);
		out = await execute('git', ['add', 'test2']);
		out = await execute('git', ['commit', '-m', '"test2 commit"']);

		tag = await git.getCurrTag();
		console.log(tag);
		expect(tag.name).toBe('test1');
		expect(tag.dist).toBe(1);

		// distance to the next tag
		// head:                  head
		// commit: test1       -> test2 -> test3
		// tag:    test1/test2             test3
		out = await execute('touch', ['test3']);
		out = await execute('git', ['add', 'test3']);
		out = await execute('git', ['commit', '-m', '"test3 commit"']);
		out = await execute('git', ['tag', 'test3']);
		out = await execute('git', ['checkout', 'HEAD^']);

		tag = await git.getCurrTag();
		console.log(tag);
		expect(tag.name).toBe('test1');
		expect(tag.dist).toBe(1);
		tag = await git.getNextTag();
		console.log(tag);
		expect(tag.name).toBe('test3');
		expect(tag.dist).toBe(1);
	});
});
