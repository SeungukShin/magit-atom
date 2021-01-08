'use babel';

export default class Log {
	static err(...args): void {
		console.log('E:', ...args);
	}

	static warn(...args): void {
		const l = atom.config.get('magit-atom.logLevel');
		if (l !== 'E') {
			console.log('W:', ...args);
		}
	}

	static info(...args): void {
		const l = atom.config.get('magit-atom.logLevel');
		if (l === 'I') {
			console.log('I:', ...args);
		}
	}
}
