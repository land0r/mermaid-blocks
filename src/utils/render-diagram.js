import { toSourceLine } from './source-line';

/**
 * Returns the errors of a diagram type whose parser lists them: pie, gitGraph
 * and other newer types. Lexing errors come first.
 *
 * @param {*} error The value Mermaid rejected with.
 *
 * @return {Object[]} The listed errors, or an empty array.
 */
function getListedErrors( error ) {
	const result = error && error.result;

	return result
		? [ ...( result.lexerErrors || [] ), ...( result.parserErrors || [] ) ]
		: [];
}

/**
 * Extracts a 1-based line number from a Mermaid error, if it carries one. The
 * number counts the lines of the text Mermaid parsed (see toSourceLine()).
 *
 * Most diagram types expose `hash.loc.first_line` (1-based) and `hash.line`
 * (0-based). The types that list their errors give each a `line`, or a `token`
 * with a `startLine`. Other errors (e.g. unknown diagram type) have none.
 *
 * @param {*} error The value Mermaid rejected with.
 *
 * @return {number|null} The 1-based line number, or null when unknown.
 */
function getErrorLine( error ) {
	const hash = error && error.hash;

	if ( hash ) {
		const firstLine = hash.loc && hash.loc.first_line;
		if ( Number.isInteger( firstLine ) && firstLine > 0 ) {
			return firstLine;
		}

		if ( Number.isInteger( hash.line ) && hash.line >= 0 ) {
			return hash.line + 1;
		}

		return null;
	}

	const [ first ] = getListedErrors( error );
	const line = first && ( first.line ?? first.token?.startLine );

	return Number.isInteger( line ) && line > 0 ? line : null;
}

/**
 * Extracts the message from a Mermaid error, without the line number Mermaid
 * puts in front of it: that one counts the lines of the text Mermaid parsed,
 * and the line is reported separately.
 *
 * @param {*} error The value Mermaid rejected with.
 *
 * @return {string} The message.
 */
function getErrorMessage( error ) {
	const listed = getListedErrors( error );

	if ( listed.length ) {
		return listed.map( ( { message } ) => message ).join( '\n' );
	}

	const message =
		( error && error.message ) ||
		( typeof error === 'string' ? error : '' ) ||
		String( error );

	return message.replace( /^Parse error on line \d+:\n/, '' );
}

/**
 * Removes the temporary elements Mermaid leaves in the document when a render
 * fails.
 *
 * Mermaid appends a `<div id="d{renderId}">` (and possibly an element with the
 * render id itself) to the `document` of the window it runs in, which is not
 * necessarily the document running this script.
 *
 * @param {string}   renderId The id passed to `mermaid.render()`.
 * @param {Document} doc      The document Mermaid rendered in.
 */
function removeLeftovers( renderId, doc ) {
	[ `d${ renderId }`, renderId ].forEach( ( id ) => {
		const element = doc.getElementById( id );
		if ( element && element.parentNode ) {
			element.parentNode.removeChild( element );
		}
	} );
}

/**
 * Renders Mermaid code to SVG and never throws.
 *
 * @param {Object}   mermaid  The Mermaid API object.
 * @param {string}   renderId A unique element id for this render call.
 * @param {string}   code     The Mermaid source.
 * @param {Document} [doc]    The document of the window Mermaid runs in.
 *
 * @return {Promise<{svg: string, bindFunctions: (Function|undefined)}|{error: {message: string, line: (number|null)}}>}
 * The SVG markup and Mermaid's function that binds its event handlers once the
 * SVG is in the page, or a normalised error: its message, and the 1-based line
 * of `code` it points at when known. Leftover DOM is removed on failure.
 */
export async function renderDiagram( mermaid, renderId, code, doc = document ) {
	try {
		const { svg, bindFunctions } = await mermaid.render( renderId, code );
		return { svg, bindFunctions };
	} catch ( error ) {
		removeLeftovers( renderId, doc );

		const line = getErrorLine( error );

		return {
			error: {
				message: getErrorMessage( error ),
				line: line === null ? null : toSourceLine( code, line ),
			},
		};
	}
}
