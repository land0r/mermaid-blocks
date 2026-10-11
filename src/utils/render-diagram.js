/**
 * Extracts a 1-based line number from a Mermaid error, if it carries one.
 *
 * Mermaid parse errors expose `hash.loc.first_line` (1-based) and
 * `hash.line` (0-based). Other errors (e.g. unknown diagram type) have neither.
 *
 * @param {*} error The value Mermaid rejected with.
 *
 * @return {number|null} The 1-based line number, or null when unknown.
 */
function getErrorLine( error ) {
	const hash = error && error.hash;

	if ( ! hash ) {
		return null;
	}

	const firstLine = hash.loc && hash.loc.first_line;
	if ( Number.isInteger( firstLine ) && firstLine > 0 ) {
		return firstLine;
	}

	if ( Number.isInteger( hash.line ) && hash.line >= 0 ) {
		return hash.line + 1;
	}

	return null;
}

/**
 * Removes the temporary elements Mermaid leaves in the document when a render
 * fails.
 *
 * Mermaid appends a `<div id="d{renderId}">` (and possibly an element with the
 * render id itself) to the `document` of the window it runs in. In the block
 * editor that is the parent admin window, not the editor iframe, so the global
 * `document` is used on purpose.
 *
 * @param {string} renderId The id passed to `mermaid.render()`.
 */
function removeLeftovers( renderId ) {
	[ `d${ renderId }`, renderId ].forEach( ( id ) => {
		const element = document.getElementById( id );
		if ( element && element.parentNode ) {
			element.parentNode.removeChild( element );
		}
	} );
}

/**
 * Renders Mermaid code to SVG and never throws.
 *
 * @param {Object} mermaid  The Mermaid API object (`window.mermaid`).
 * @param {string} renderId A unique element id for this render call.
 * @param {string} code     The Mermaid source.
 *
 * @return {Promise<{svg: string}|{error: {message: string, line: (number|null)}}>}
 * The SVG markup, or a normalised error. Leftover DOM is removed on failure.
 */
export async function renderDiagram( mermaid, renderId, code ) {
	try {
		const { svg } = await mermaid.render( renderId, code );
		return { svg };
	} catch ( error ) {
		removeLeftovers( renderId );

		const message =
			( error && error.message ) ||
			( typeof error === 'string' ? error : '' ) ||
			String( error );

		return { error: { message, line: getErrorLine( error ) } };
	}
}
