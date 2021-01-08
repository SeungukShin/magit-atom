'use babel';

const GIT_REFS = {
	'heads': 'HEAD',
	'tags': 'tag: refs/tags/',
	'locals': 'refs/heads/',
	'remotes': 'refs/remotes/',
	'bisects': 'refs/bisect/',
	'wips': 'refs/wip/',
	'pullreqs': 'refs/pullreqs'
};

export default class GitLog {
	hash: String;
	labels = {};
	subject: String;
	body: String;

	constructor() {
		this.hash = '';
		for (const key in GIT_REFS) {
			this.labels[key] = [];
		}
		this.subject = '';
		this.body = '';
	}

	static create(line: String): GitLog {
		const gitLog = new GitLog();
		gitLog.parseOneLine(line);
		return gitLog;
	}

	getHash(): String {
		return this.hash;
	}

	getLabels(key: String): String[] {
		return this.labels[key];
	}

	setLabel(label: String): void {
		for (const key in GIT_REFS) {
			if (label.startsWith(GIT_REFS[key])) {
				const msg = label.substring(GIT_REFS[key].length);
				this.labels[key].push(msg);
				break;
			}
		}
	}

	getSubject(): String {
		return this.subject;
	}

	getBody(): String {
		return this.body;
	}

	parseOneLine(line: String): void {
		const start = line.indexOf(' ');
		const end = line.indexOf(')', start);
		this.hash = line.substring(0, start);
		if (line[start + 1] === '(' && end > start) {
			this.subject = line.substring(end + 2);
			const labels = line.substring(start + 2, end);
			for (const label of labels.split(/(, | -> )/g)) {
				this.setLabel(label);
			}
		} else {
			this.subject = line.substring(start + 1);
		}
	}
}
