'use babel';

export default class GitTag {
	name: String;
	dist: Number;

	constructor(name: String = '', dist: Number = 0) {
		this.name = name;
		this.dist = dist;
	}
}
