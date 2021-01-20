'use babel';

class Hunk {
	head: String;
	body: String[];

	constructor(line: String) {
		this.head = line;
		this.body = [];
	}

	getHead(): String {
		return this.head;
	}

	getBody(): String[] {
		return this.body;
	}
}

export default class GitDiff {
	state: String; // head, hunk
	fromFile: String;
	toFile: String;
	fromRev: String;
	toRev: String;
	hunks: Hunk[];

	constructor() {
		this.state = 'head';
		this.fromFile = '';
		this.toFile = '';
		this.fromRev = '';
		this.toRev = '';
		this.hunks = [];
	}

	getHunks(): Hunk[] {
		return this.hunks;
	}

	append(line: String): void {
		if (this.state === 'head') {
			if (line.startsWith('diff')) {
				const list = line.split(' ');
				if (list.length < 4) {
					return;
				}
				this.fromFile = list[2];
				this.toFile = list[3];
			} else if (line.startsWith('index')) {
				const list = line.split(' ');
				if (list.length < 3) {
					return;
				}
				const revs = list[1].split('..');
				if (revs.length < 2) {
					return;
				}
				this.fromRev = revs[0];
				this.toRev = revs[1];
			}
			if (this.fromFile.length > 0 && this.fromRev.length > 0) {
				this.state = 'hunk';
			}
		} else {
			if (line.startsWith('@@ ')) {
				this.hunks.push(new Hunk(line));
			} else {
				if (this.hunks.length > 0) {
					const hunk = this.hunks[this.hunks.length - 1];
					hunk.body.push(line);
				}
			}
		}
	}
}
