import { toSourceLine } from '../utils/source-line';
import { getPaletteName } from '../utils/pele-palette';

/*
 * Pele as a renderer: see createMermaidRenderer() in mermaid.js for the
 * interface.
 *
 * Pele draws synchronously, as SVG text that CSS variables colour, and
 * touches nothing in the document: there is nothing to queue, and nothing to
 * clean up after a failure. Its `render()` is used, never its `mount()`, so
 * Pele's own zoom and resizing stay off.
 */

// Pele's prefix on a syntax error, which counts the lines of the text it
// parsed: the line is reported separately, as a line of the code.
const PARSE_PREFIX = /^Parse error on line \d+:\n/;

/**
 * Returns the message and the line of an error Pele threw.
 *
 * @param {*}      error The value Pele threw: a `PeleError` has a `line`, which
 *                       is 0 when the error points at no line.
 * @param {string} code  The Mermaid source.
 *
 * @return {{error: {message: string, line: (number|null)}}} The error as the
 * renderers report it: the message with the snippet and caret Pele gives, and
 * the 1-based line of `code`, front matter and directives counted.
 */
function normaliseError( error, code ) {
	const message =
		( error && error.message ) ||
		( typeof error === 'string' ? error : '' ) ||
		String( error );
	const line = error && error.line;

	return {
		error: {
			message: message.replace( PARSE_PREFIX, '' ),
			line:
				Number.isInteger( line ) && line > 0
					? toSourceLine( code, line )
					: null,
		},
	};
}

/**
 * Gives the root element of the SVG the id of the drawing, as Mermaid.js does:
 * the ids of the accessible title and description are made from it.
 *
 * @param {string} svg The SVG markup.
 * @param {string} id  The id of the drawing.
 *
 * @return {string} The SVG markup.
 */
function withId( svg, id ) {
	return svg.replace( /^<svg\b/, `<svg id="${ id }"` );
}

/**
 * Writes the font into the root element of the SVG as `--pele-font`, which
 * Pele's text takes its font family from, so labels are drawn in the font they
 * were measured in.
 *
 * @param {string} svg  The SVG markup.
 * @param {string} font The font family.
 *
 * @return {string} The SVG markup.
 */
function withFont( svg, font ) {
	if ( ! font ) {
		return svg;
	}

	const value = font.replace( /"/g, '&quot;' );

	return svg.replace(
		/^(<svg\b[^>]*?\sstyle=")/,
		`$1--pele-font:${ value };`
	);
}

/**
 * Loads the code of the diagram type of some code, in Pele's lazy build. The
 * single-file build has every type and no `load()`.
 *
 * @param {Object} pele The Pele module.
 * @param {string} code The Mermaid source.
 */
async function loadType( pele, code ) {
	if ( typeof pele.load !== 'function' ) {
		return;
	}

	let type = null;

	try {
		type = pele.detectType( code );
	} catch ( error ) {
		// An error is reported by render().
	}

	await pele.load( type );
}

/**
 * Wraps the Pele module in the renderer interface.
 *
 * @param {Object}   pele               The Pele module: the lazy build's, or the
 *                                      single-file build's.
 * @param {Object}   [options]          Options.
 * @param {Document} [options.doc]      The document of the window Pele runs in.
 * @param {Object}   [options.measurer] Measures text, where the browser's
 *                                      canvas can't: see Pele's `TextMeasurer`.
 *
 * @return {{name: string, document: Document, draw: Function, parse: Function, getPalette: Function}}
 * The renderer. `draw()` also resolves to the `palette` the SVG is drawn in,
 * which the caller puts on the element that holds it.
 */
export function createPeleRenderer( pele, { doc = document, measurer } = {} ) {
	return {
		name: 'pele',
		document: doc,

		async draw( code, theme, element, id ) {
			try {
				await loadType( pele, code );

				const view = element.ownerDocument.defaultView;
				const font = view
					? view.getComputedStyle( element ).fontFamily
					: '';
				const options = {
					idPrefix: id,
					responsive: true,
					autoDirection: false,
				};

				if ( font ) {
					options.fontFamily = font;
				}

				if ( measurer ) {
					options.measurer = measurer;
				}

				const { svg } = pele.render( code, options );

				return {
					svg: withId( withFont( svg, font ), id ),
					palette: getPaletteName( theme, code ),
				};
			} catch ( error ) {
				return normaliseError( error, code );
			}
		},

		/**
		 * Tells the palette a diagram is drawn in. Pele's colours are CSS
		 * variables, so a diagram changes palette without being drawn again.
		 *
		 * @param {string} code  The Mermaid source.
		 * @param {string} theme What the diagram is drawn in.
		 *
		 * @return {string} `light` or `dark`.
		 */
		getPalette: ( code, theme ) => getPaletteName( theme, code ),

		async parse( code ) {
			try {
				await loadType( pele, code );

				return { type: pele.parse( code ).mermaidType };
			} catch ( error ) {
				return normaliseError( error, code );
			}
		},
	};
}
