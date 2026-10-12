import MERMAID_CONFIG from './mermaid-config';
import { AUTO_LIGHT, getThemeConfig } from './themes';
import { toSourceLine } from './source-line';

/*
 * Mermaid has one configuration per window, and no theme per render. A
 * diagram is drawn in its own theme by initialising Mermaid again before it
 * renders, and no other diagram may render in the meantime: Mermaid reads its
 * configuration all through a render.
 *
 * Kept for each Mermaid instance: the theme it was last initialised with, and
 * its last render, which the next one waits for.
 */
const themes = new WeakMap();
const renders = new WeakMap();

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
 * Renders Mermaid code to SVG, once the renders before it are done.
 *
 * @param {Object}   mermaid  The Mermaid API object.
 * @param {string}   renderId A unique element id for this render call.
 * @param {string}   code     The Mermaid source.
 * @param {Document} doc      The document of the window Mermaid runs in.
 * @param {string}   theme    What to draw the diagram in.
 *
 * @return {Promise<Object>} The result: see renderDiagram().
 */
async function renderInTheme( mermaid, renderId, code, doc, theme ) {
	try {
		// Mermaid starts out in AUTO_LIGHT: mermaid-config.js names no theme.
		if ( ( themes.get( mermaid ) || AUTO_LIGHT ) !== theme ) {
			mermaid.initialize( {
				...MERMAID_CONFIG,
				...getThemeConfig( mermaid, theme ),
			} );
			themes.set( mermaid, theme );
		}

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

/**
 * Renders Mermaid code to SVG and never throws.
 *
 * The source decides before the theme does: a theme set in its front matter
 * or in a directive wins.
 *
 * @param {Object}   mermaid  The Mermaid API object.
 * @param {string}   renderId A unique element id for this render call.
 * @param {string}   code     The Mermaid source.
 * @param {Document} [doc]    The document of the window Mermaid runs in.
 * @param {string}   [theme]  What to draw the diagram in, as resolveTheme()
 *                            returns it. Defaults to what Mermaid picks.
 *
 * @return {Promise<{svg: string, bindFunctions: (Function|undefined)}|{error: {message: string, line: (number|null)}}>}
 * The SVG markup and Mermaid's function that binds its event handlers once the
 * SVG is in the page, or a normalised error: its message, and the 1-based line
 * of `code` it points at when known. Leftover DOM is removed on failure.
 */
export function renderDiagram(
	mermaid,
	renderId,
	code,
	doc = document,
	theme = AUTO_LIGHT
) {
	const result = ( renders.get( mermaid ) || Promise.resolve() ).then( () =>
		renderInTheme( mermaid, renderId, code, doc, theme )
	);

	renders.set( mermaid, result );

	return result;
}

/**
 * Parses Mermaid code without rendering it, and never throws. It waits for
 * the renders before it, as renderDiagram() does: Mermaid applies the code's
 * own configuration while it parses.
 *
 * @param {Object} mermaid The Mermaid API object.
 * @param {string} code    The Mermaid source.
 *
 * @return {Promise<{type: string}|{error: {message: string, line: (number|null)}}>}
 * The type Mermaid detected, such as `flowchart-v2` or `sequence`, or the
 * error, normalised as renderDiagram() does.
 */
export function parseDiagram( mermaid, code ) {
	const result = ( renders.get( mermaid ) || Promise.resolve() ).then(
		async () => {
			try {
				const { diagramType } = await mermaid.parse( code );
				return { type: diagramType };
			} catch ( error ) {
				const line = getErrorLine( error );

				return {
					error: {
						message: getErrorMessage( error ),
						line: line === null ? null : toSourceLine( code, line ),
					},
				};
			}
		}
	);

	renders.set( mermaid, result );

	return result;
}
