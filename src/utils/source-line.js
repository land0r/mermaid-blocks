/*
 * What Mermaid 12 removes from the source before parsing it, in this order
 * (preprocessDiagram() in mermaid/src/preprocess.ts): the front matter, then
 * `%%{ }%%` directives, then `%%` comment lines, then leading whitespace.
 */
const FRONT_MATTER =
	/^([ \t]*)---[ \t]*\n(?:[\s\S]*?\n)?\1---[ \t]*\n(?:[ \t]*\n)*/g;
const DIRECTIVE =
	/%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi;
const COMMENT_LINE = /^\s*%%(?!{)[^\n]+\n?/gm;
const LEADING_WHITESPACE = /^\s+/g;

/**
 * Removes every match of `pattern` from a text, keeping each remaining
 * character's original line number.
 *
 * @param {{text: string, lines: number[]}} source  The text and the line
 *                                                  number of each character.
 * @param {RegExp}                          pattern A global pattern.
 *
 * @return {{text: string, lines: number[]}} The text without the matches.
 */
function removeMatches( source, pattern ) {
	let text = '';
	let lines = [];
	let last = 0;

	for ( const match of source.text.matchAll( pattern ) ) {
		text += source.text.slice( last, match.index );
		lines = lines.concat( source.lines.slice( last, match.index ) );
		last = match.index + match[ 0 ].length;
	}

	return {
		text: text + source.text.slice( last ),
		lines: lines.concat( source.lines.slice( last ) ),
	};
}

/**
 * Maps a line number in a Mermaid parse error back to the line of the source
 * the user wrote.
 *
 * Mermaid numbers lines after removing the front matter, directives, comment
 * lines and leading blank lines, so an error below any of them points too
 * high. This applies the same removals and keeps track of where each
 * remaining character came from.
 *
 * Two newer diagram types, eventmodeling and agentflow, keep comment lines
 * when parsing; for them, the result is too low by the number of comment
 * lines above the error.
 *
 * @param {string} code The Mermaid source.
 * @param {number} line The 1-based line number Mermaid reported.
 *
 * @return {number} The 1-based line number in `code`.
 */
export function toSourceLine( code, line ) {
	const text = String( code ).replace( /\r\n?/g, '\n' );
	const lines = [];

	for ( let index = 0, current = 1; index < text.length; index++ ) {
		lines.push( current );
		if ( text[ index ] === '\n' ) {
			current += 1;
		}
	}

	const parsed = [
		FRONT_MATTER,
		DIRECTIVE,
		COMMENT_LINE,
		LEADING_WHITESPACE,
	].reduce( removeMatches, { text, lines } );

	if ( parsed.lines.length === 0 ) {
		return line;
	}

	// Where the reported line starts in the parsed text. Mermaid appends a
	// line break before parsing, so an error at the very end can point one
	// line past the text: that maps to its last line.
	let start = 0;
	for ( let current = 1; current < line; current++ ) {
		const next = parsed.text.indexOf( '\n', start );
		if ( next === -1 ) {
			break;
		}
		start = next + 1;
	}

	return parsed.lines[ Math.min( start, parsed.lines.length - 1 ) ];
}
