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

	it('version', async () => {
		const git = new Git(cwd);
		const version = await git.getVersion();
		console.log(version);
		expect(version[0]).toBe('2');
		expect(version[1]).toBe('29');
		expect(version[2]).toBe('2');
	});
});
