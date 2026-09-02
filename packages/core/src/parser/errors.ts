export class ParseError extends Error {
	readonly source: string;

	constructor(source: string, message: string) {
		super(`${message} while parsing ${JSON.stringify(source)}`);
		this.name = new.target.name;
		this.source = source;
	}
}

export class TableNotFoundError extends ParseError {
	constructor(source: string) {
		super(source, 'Cannot find a current MyBK timetable');
	}
}

export class SemesterNotFoundError extends ParseError {
	constructor(source: string) {
		super(source, 'Cannot extract the semester and academic year');
	}
}

export class SourceUpdatedAtNotFoundError extends ParseError {
	constructor(source: string) {
		super(source, 'Cannot extract the source update timestamp');
	}
}

export class ColumnCountError extends ParseError {
	readonly expected: number;
	readonly actual: number;

	constructor(source: string, expected: number, actual: number) {
		super(source, `Expected ${expected} columns, found ${actual}`);
		this.expected = expected;
		this.actual = actual;
	}
}
