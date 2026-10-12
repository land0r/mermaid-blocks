import { getIndentEdit, INDENT } from '../indent';

/**
 * Applies getIndentEdit() to a text whose selection is marked with `[` and
 * `]`, or whose caret is marked with `|`, and returns the result marked the
 * same way. Returns null when there is nothing to change.
 *
 * @param {string}  marked  The text with its selection or caret marked.
 * @param {boolean} outdent Whether to outdent.
 *
 * @return {string|null} The edited text with its selection or caret marked.
 */
function press( marked, outdent = false ) {
	const caret = marked.indexOf( '|' );
	const selectionStart = caret === -1 ? marked.indexOf( '[' ) : caret;
	const selectionEnd = caret === -1 ? marked.indexOf( ']' ) - 1 : caret;
	const value = marked.replace( /[|[\]]/g, '' );

	const edit = getIndentEdit( value, selectionStart, selectionEnd, outdent );
	if ( ! edit ) {
		return null;
	}

	const result =
		value.slice( 0, edit.start ) + edit.text + value.slice( edit.end );
	const mark = ( text, position, character ) =>
		text.slice( 0, position ) + character + text.slice( position );

	return edit.selectionStart === edit.selectionEnd
		? mark( result, edit.selectionStart, '|' )
		: mark(
				mark( result, edit.selectionEnd, ']' ),
				edit.selectionStart,
				'['
		  );
}

const tab = ( marked ) => press( marked );
const shiftTab = ( marked ) => press( marked, true );

describe( 'getIndentEdit', () => {
	it( 'uses four spaces', () => {
		expect( INDENT ).toBe( '    ' );
	} );

	describe( 'Tab', () => {
		it( 'inserts an indent at the caret', () => {
			expect( tab( 'A|B' ) ).toBe( 'A    |B' );
			expect( tab( '|' ) ).toBe( '    |' );
		} );

		it( 'indents the line of a selection within one line', () => {
			expect( tab( 'A --> [B]' ) ).toBe( '    A --> [B]' );
		} );

		it( 'indents every line the selection touches', () => {
			expect( tab( 'graph\nA[ --> B\nB --] > C\nD' ) ).toBe(
				'graph\n    A[ --> B\n    B --] > C\nD'
			);
		} );

		it( 'keeps a selection that starts at a line start around the indent', () => {
			expect( tab( '[A\nB]' ) ).toBe( '[    A\n    B]' );
		} );

		it( 'leaves out a line the selection only reaches the start of', () => {
			expect( tab( '[A\nB\n]C' ) ).toBe( '[    A\n    B\n]C' );
		} );

		it( 'does not indent empty lines', () => {
			expect( tab( '[A\n\nB]' ) ).toBe( '[    A\n\n    B]' );
		} );
	} );

	describe( 'Shift+Tab', () => {
		it( 'removes one indent from the line of the caret', () => {
			expect( shiftTab( '        A|B' ) ).toBe( '    A|B' );
		} );

		it( 'removes a shorter indent or a tab', () => {
			expect( shiftTab( '  A|' ) ).toBe( 'A|' );
			expect( shiftTab( '\tA|' ) ).toBe( 'A|' );
		} );

		it( 'keeps a caret inside the removed indent at the line start', () => {
			expect( shiftTab( 'X\n  |  A' ) ).toBe( 'X\n|A' );
		} );

		it( 'outdents every line the selection touches', () => {
			expect(
				shiftTab( 'graph\n    A[ --> B\n  B --] > C\n    D' )
			).toBe( 'graph\nA[ --> B\nB --] > C\n    D' );
		} );

		it( 'changes nothing when there is no indent to remove', () => {
			expect( shiftTab( 'A|' ) ).toBeNull();
			expect( shiftTab( '[A\nB]' ) ).toBeNull();
		} );
	} );
} );
