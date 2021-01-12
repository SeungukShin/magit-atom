'use babel';

import * as process from 'process';
import * as cp from 'child_process';
import * as rl from 'readline';
import Git from '../lib/git';

describe('Git', () => {
	const cwd = process.cwd();
	const git = new Git(cwd);

	it('version', async () => {
		const version = await git.getVersion();
		console.log(version);
		expect(version[0]).toBe('2');
		expect(version[1]).toBe('29');
		expect(version[2]).toBe('2');
	});
});
