'use babel';

import * as cp from 'child_process';

class Result {
	cmd: String;
	out: String;
	err: String;
	code: Number;

	constructor() {
		this.cmd = '';
		this.out = '';
		this.err = '';
		this.code = 0;
	}
}

// executes @cmd with @args and concatenates outputs and returns it.
export async function execute(cmd: String, args: String[], ignoreError: Boolean = false): Promise<Result> {
	return new Promise((resolve, reject) => {
		const result = new Result();
		result.cmd = `${cmd} ${args.join(' ')}`;
		console.log(result.cmd);
		let out = '';
		let err = '';
		const proc = cp.spawn(cmd, args);
		proc.stdout.on('data', (data) => {
			out = out.concat(data.toString());
		});
		proc.stderr.on('data', (data) => {
			err = err.concat(data.toString());
		});
		proc.on('error', (error) => {
			console.log('error:', error);
			if (!ignoreError) {
				reject(error.toString().trim());
			}
		});
		proc.on('close', (code) => {
			result.code = code;
			if (err.length > 0) {
				result.err = err;
				console.log(`stderr: ${code}\n${err}`);
			}
			result.out = out;
			console.log(`stdout: ${code}\n${out}`);
			if (code != 0 && !ignoreError) {
				reject(err.trim());
			} else {
				resolve(out.trim());
			}
		});
	});
}
