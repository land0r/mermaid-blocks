import MERMAID_CONFIG, { mergeConfig } from '../utils/mermaid-config';
import { AUTO_LIGHT, getThemeConfig } from '../utils/themes';
import { getParsedText } from '../utils/source-line';
import { loadPack } from '../utils/icons';
import { getMessage, toError } from './error';

/*
 * Mermaid.js as a renderer: see createMermaidRenderer() for the interface.
 *
 * Mermaid has one configuration per window, and no theme per render. A
 * diagram is drawn in its own theme by initialising Mermaid again before it
 * renders, and no other diagram may render in the meantime: Mermaid reads its
 * configuration all through a render.
 *
 * Kept for each Mermaid instance: the configuration it was last initialised
 * with, and its last render, which the next one waits for.
 */
const configs = new WeakMap();
const renders = new WeakMap();

// The Mermaid instances that were given the site's icon packs.
const withPacks = new WeakSet();

// What Mermaid starts out with: see load-mermaid.js and index.js.
const INITIAL_CONFIG = JSON.stringify( MERMAID_CONFIG );

// The keyword flowcharts asked for the ELK layout with before Mermaid 11.
// Mermaid 12 takes such a diagram for a flowchart like any other.
const ELK_FLOWCHART = /^flowchart-elk/;

/**
 * Returns the configuration a diagram renders with.
 *
 * @param {Object} mermaid The Mermaid API object.
 * @param {string} code    The Mermaid source.
 * @param {string} theme   What to draw the diagram in.
 *
 * @return {Object} Options for `mermaid.initialize()`: the shared ones, the
 * theme, and ELK as the layout of a flowchart whose keyword asks for it.
 */
function getConfig( mermaid, code, theme ) {
	const config = mergeConfig(
		MERMAID_CONFIG,
		getThemeConfig( mermaid, theme )
	);

	return ELK_FLOWCHART.test( getParsedText( code ) )
		? mergeConfig( config, { flowchart: { layout: 'elk' } } )
		: config;
}

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

	return getMessage( error ).replace( /^Parse error on line \d+:\n/, '' );
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
 * @return {Promise<Object>} The result: see draw().
 */
async function renderInTheme( mermaid, renderId, code, doc, theme ) {
	try {
		const config = getConfig( mermaid, code, theme );
		const key = JSON.stringify( config );

		if ( ( configs.get( mermaid ) || INITIAL_CONFIG ) !== key ) {
			mermaid.initialize( config );
			configs.set( mermaid, key );
		}

		const { svg, bindFunctions } = await mermaid.render( renderId, code );
		return { svg, bindFunctions };
	} catch ( error ) {
		removeLeftovers( renderId, doc );

		return toError( code, getErrorMessage( error ), getErrorLine( error ) );
	}
}

/**
 * Draws Mermaid code as SVG and never throws.
 *
 * The source decides before the theme does: a theme set in its front matter
 * or in a directive wins.
 *
 * @param {Object}   mermaid The Mermaid API object.
 * @param {Document} doc     The document of the window Mermaid runs in.
 * @param {string}   code    The Mermaid source.
 * @param {string}   theme   What to draw the diagram in, as resolveTheme()
 *                           returns it.
 * @param {string}   id      A unique element id for this drawing.
 *
 * @return {Promise<{svg: string, bindFunctions: (Function|undefined)}|{error: {message: string, line: (number|null)}}>}
 * The SVG markup and Mermaid's function that binds its event handlers once the
 * SVG is in the page, or a normalised error: its message, and the 1-based line
 * of `code` it points at when known. Leftover DOM is removed on failure.
 */
function draw( mermaid, doc, code, theme, id ) {
	const result = ( renders.get( mermaid ) || Promise.resolve() ).then( () =>
		renderInTheme( mermaid, id, code, doc, theme )
	);

	renders.set( mermaid, result );

	return result;
}

/**
 * Parses Mermaid code without drawing it, and never throws. It waits for the
 * drawings before it, as draw() does: Mermaid applies the code's own
 * configuration while it parses.
 *
 * @param {Object} mermaid The Mermaid API object.
 * @param {string} code    The Mermaid source.
 *
 * @return {Promise<{type: string}|{error: {message: string, line: (number|null)}}>}
 * The type Mermaid detected, such as `flowchart-v2` or `sequence`, or the
 * error, normalised as draw() does.
 */
function parse( mermaid, code ) {
	const result = ( renders.get( mermaid ) || Promise.resolve() ).then(
		async () => {
			try {
				const { diagramType } = await mermaid.parse( code );
				return { type: diagramType };
			} catch ( error ) {
				return toError(
					code,
					getErrorMessage( error ),
					getErrorLine( error )
				);
			}
		}
	);

	renders.set( mermaid, result );

	return result;
}

/**
 * Registers the site's icon packs with Mermaid, once. Mermaid calls a pack's
 * loader only for a diagram that uses one of its icons, and shows its own mark
 * for an icon it can't have.
 *
 * @param {Object}                 mermaid The Mermaid API object.
 * @param {Object<string, string>} packs   The URL of the Iconify JSON of each
 *                                         pack, by name.
 */
function registerIconPacks( mermaid, packs ) {
	if ( withPacks.has( mermaid ) || ! Object.keys( packs ).length ) {
		return;
	}

	withPacks.add( mermaid );
	mermaid.registerIconPacks(
		Object.entries( packs ).map( ( [ name, url ] ) => ( {
			name,
			loader: async () => {
				const data = await loadPack( url );

				if ( ! data ) {
					throw new Error( `The icon pack ${ name } is not loaded.` );
				}

				return data;
			},
		} ) )
	);
}

/**
 * Wraps a Mermaid API object in the renderer interface, which Pele has too:
 *
 * - `draw( code, theme, element, id )` resolves to `{ svg }`, or to
 *   `{ error: { message, line } }` with the 1-based line of the code. It never
 *   rejects, and leaves nothing behind in the document.
 * - `parse( code )` resolves to `{ type }`, or to the same error.
 * - `getStyle( code, theme, element )` returns the CSS properties to put on
 *   the element that holds the SVG, for a diagram shown in `element` (null
 *   for one that isn't on a page), or null. Pele's colours are such
 *   properties, so its diagrams change colours in place, without being drawn
 *   again. Mermaid.js's SVG has its colours in it.
 *
 * @param {Object}                 mermaid             The Mermaid API object.
 * @param {Object}                 [options]           Options, as Pele's
 *                                                     renderer takes them.
 * @param {Document}               [options.doc]       The document of the window
 *                                                     Mermaid runs in.
 * @param {Object<string, string>} [options.iconPacks] The URL of the Iconify
 *                                                     JSON of each icon pack the
 *                                                     site registered, by name.
 *
 * @return {{name: string, document: Document, draw: Function, parse: Function, getStyle: Function}}
 * The renderer.
 */
export function createMermaidRenderer(
	mermaid,
	{ doc = document, iconPacks = {} } = {}
) {
	registerIconPacks( mermaid, iconPacks );

	return {
		name: 'mermaid',
		document: doc,
		// What a failed drawing leaves is in the document Mermaid runs in.
		draw: ( code, theme, element, id ) =>
			draw( mermaid, doc, code, theme || AUTO_LIGHT, id ),
		parse: ( code ) => parse( mermaid, code ),
		getStyle: () => null,
	};
}
