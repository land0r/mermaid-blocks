/**
 * One level of indentation. Spaces, because YAML front matter rejects tabs.
 */
export const INDENT = '    ';

// What Shift+Tab removes from the start of a line: a tab, or up to one indent.
const LEADING_INDENT = new RegExp( `^(?:\\t| {1,${ INDENT.length }})?` );

/**
 * Maps a position in the old text to the new one, given the changes made at
 * the start of lines.
 *
 * @param {Array<{at: number, inserted: number, removed: number}>} changes  Changes, in order.
 * @param {number}                                                 position A position in the old text.
 *
 * @return {number} The position in the new text.
 */
function mapPosition( changes, position ) {
	let shift = 0;

	for ( const { at, inserted, removed } of changes ) {
		if ( at >= position ) {
			break;
		}
		shift += inserted - Math.min( removed, position - at );
	}

	return position + shift;
}

/**
 * Works out the edit that Tab or Shift+Tab makes in a code field, as code
 * editors do:
 *
 * - Tab with nothing selected inserts an indent at the caret.
 * - Tab with a selection indents every line the selection touches.
 * - Shift+Tab removes one indent from every line the caret or the selection
 *   touches.
 *
 * A selection that ends at the start of a line doesn't touch that line, and
 * empty lines are not indented.
 *
 * @param {string}  value          The text.
 * @param {number}  selectionStart Where the selection starts.
 * @param {number}  selectionEnd   Where the selection ends.
 * @param {boolean} [outdent]      Whether to remove an indent (Shift+Tab).
 *
 * @return {{start: number, end: number, text: string, selectionStart: number, selectionEnd: number}|null}
 * The range to replace, its replacement and the selection afterwards, or null
 * when there is nothing to change.
 */
export function getIndentEdit(
	value,
	selectionStart,
	selectionEnd,
	outdent = false
) {
	if ( ! outdent && selectionStart === selectionEnd ) {
		return {
			start: selectionStart,
			end: selectionEnd,
			text: INDENT,
			selectionStart: selectionStart + INDENT.length,
			selectionEnd: selectionEnd + INDENT.length,
		};
	}

	const start = value.lastIndexOf( '\n', selectionStart - 1 ) + 1;
	const lastTouched =
		selectionEnd > selectionStart && value[ selectionEnd - 1 ] === '\n'
			? selectionEnd - 1
			: selectionEnd;
	const nextBreak = value.indexOf( '\n', lastTouched );
	const end = nextBreak === -1 ? value.length : nextBreak;

	// What changes at the start of each line.
	let at = start;
	const changes = value
		.slice( start, end )
		.split( '\n' )
		.map( ( line ) => {
			const change = { at, line, inserted: 0, removed: 0 };
			at += line.length + 1;

			if ( outdent ) {
				change.removed = line.match( LEADING_INDENT )[ 0 ].length;
			} else if ( line !== '' ) {
				change.inserted = INDENT.length;
			}

			return change;
		} );

	if (
		changes.every( ( { inserted, removed } ) => ! inserted && ! removed )
	) {
		return null;
	}

	return {
		start,
		end,
		text: changes
			.map(
				( { line, inserted, removed } ) =>
					INDENT.slice( 0, inserted ) + line.slice( removed )
			)
			.join( '\n' ),
		selectionStart: mapPosition( changes, selectionStart ),
		selectionEnd: mapPosition( changes, selectionEnd ),
	};
}
