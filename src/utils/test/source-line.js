import { getParsedText, toSourceLine } from '../source-line';

// A sequence diagram whose third line is the mistake, with optional text
// before it and between its second and third lines.
const diagram = ( before = '', between = '' ) =>
	`${ before }sequenceDiagram\n  Alice->>Bob: Hi\n${ between }  Bob->>: BAD\n  Bob-->>Alice: ok`;

const lineOfMistake = ( code ) =>
	code
		.replace( /\r\n?/g, '\n' )
		.split( '\n' )
		.findIndex( ( line ) => line.includes( 'BAD' ) ) + 1;

/*
 * The line Mermaid 12.1.0 reports for each source was recorded from the real
 * library: it is always 3 here, the mistake's line once Mermaid has removed
 * what it removes, except where noted.
 */
describe( 'toSourceLine', () => {
	it.each( [
		[ 'nothing to remove', diagram(), 3 ],
		[
			'front matter',
			diagram( '---\ntitle: Hello\nconfig:\n  theme: dark\n---\n' ),
			3,
		],
		[
			'front matter followed by blank lines',
			diagram( '---\ntitle: Hello\n---\n\n\n' ),
			3,
		],
		[ 'leading blank lines', diagram( '\n\n' ), 3 ],
		[
			'a directive on its own line',
			diagram( '%%{init: {"theme": "dark"}}%%\n' ),
			3,
		],
		[ 'a comment on the first line', diagram( '%% top comment\n' ), 3 ],
		[
			'comment lines above the mistake',
			diagram( '', '  %% a comment\n  %% another\n' ),
			3,
		],
		[
			'blank lines before a comment, which go with it',
			diagram( '', '\n\n  %% a comment\n' ),
			3,
		],
		[
			'front matter and comments, with a blank line that stays',
			diagram( '---\ntitle: T\n---\n%% c1\n', '%% c2\n\n' ),
			4,
		],
		[
			'Windows line endings',
			diagram( '---\ntitle: T\n---\n' ).replace( /\n/g, '\r\n' ),
			3,
		],
	] )( 'maps past %s', ( name, code, reported ) => {
		expect( toSourceLine( code, reported ) ).toBe( lineOfMistake( code ) );
	} );

	it( 'maps a line past the end to the last line', () => {
		// Mermaid appends a line break, so an unclosed bracket on the last
		// line can be reported one line further.
		const code = '---\ntitle: T\n---\nflowchart LR\n  A --> B{BAD';

		expect( toSourceLine( code, 3 ) ).toBe( 5 );
		expect( toSourceLine( code, 9 ) ).toBe( 5 );
	} );

	it( 'returns the line as is when nothing is left to parse', () => {
		expect( toSourceLine( '%% only a comment', 1 ) ).toBe( 1 );
		expect( toSourceLine( '', 2 ) ).toBe( 2 );
	} );
} );

describe( 'getParsedText', () => {
	it.each( [
		[ 'nothing to remove', 'flowchart LR\nA --> B' ],
		[
			'front matter',
			'---\ntitle: T\nconfig:\n  theme: dark\n---\nflowchart LR\nA --> B',
		],
		[ 'leading blank lines', '\n\n  flowchart LR\nA --> B' ],
		[
			'a directive',
			'%%{init: {"theme": "dark"}}%%\nflowchart LR\nA --> B',
		],
		[
			'a comment on the first line',
			'%% a comment\nflowchart LR\nA --> B',
		],
		[
			'Windows line endings',
			'---\r\ntitle: T\r\n---\r\nflowchart LR\r\nA --> B',
		],
	] )( 'starts with the keyword past %s', ( name, code ) => {
		expect( getParsedText( code ) ).toBe( 'flowchart LR\nA --> B' );
	} );

	it( 'keeps what follows the keyword as it is', () => {
		expect(
			getParsedText( 'flowchart LR\n  %% a comment\n  A --> B\n' )
		).toBe( 'flowchart LR\n  A --> B\n' );
	} );

	it.each( [ [ '' ], [ '%% only a comment' ], [ undefined ] ] )(
		'returns a text for %p',
		( code ) => {
			expect( typeof getParsedText( code ) ).toBe( 'string' );
		}
	);
} );
