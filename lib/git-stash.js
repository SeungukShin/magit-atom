'use babel';

export default class GitStash {
	id: Number;
	subject: String;

	constructor() {
		this.id = -1;
		this.subject = '';
	}

	static create(line: String): GitStash {
		const gitStash = new GitStash();
		const sep = line.indexOf(':');
		gitStash.id = parseInt(line.substring(7, sep - 1));
		gitStash.subject = line.substring(sep + 2);
		return gitStash;
	}

	getID(): Number {
		return this.id;
	}

	getSubject(): String {
		return this.subject;
	}
}
