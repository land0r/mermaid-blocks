import { getPaletteName, getPaletteVariables } from '../utils/pele-palette';
import { getSurface } from '../utils/surface';
import getContentWidth from '../utils/content-width';
import { createIcons } from '../frontend/icons';
import { getMessage, toError } from './error';

/*
 * Pele as a renderer: see createMermaidRenderer() in mermaid.js for the
 * interface.
 *
 * Pele draws synchronously, as SVG text that CSS variables colour, and
 * touches nothing in the document: there is nothing to queue, and nothing to
 * clean up after a failure. Its `render()` is used, never its `mount()`: the
 * plugin lays a diagram out for the width of the element it is drawn in
 * (`maxWidth`), and draws it again when that width changes (see
 * watch-width.js), where `mount()` would do both itself.
 */

// Pele's prefix on a syntax error, which counts the lines of the text it
// parsed: the line is reported separately, as a line of the code. A lexical
// error has its own: "Lexical error on line 3. Unrecognized text."
const PARSE_PREFIX =
	/^(?:Parse error on line \d+:\n|Lexical error on line \d+\.\s*)/;

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
	return toError(
		code,
		getMessage( error ).replace( PARSE_PREFIX, '' ),
		error && error.line
	);
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

	const value = font.replace( /&/g, '&amp;' ).replace( /"/g, '&quot;' );

	// A function, so a `$` in the font is not taken for a pattern of the replacement.
	return svg.replace(
		/^<svg\b[^>]*?\sstyle="/,
		( start ) => `${ start }--pele-font:${ value };`
	);
}

/**
 * Reads the fonts a diagram is drawn in, as Pele's `mount()` does: the
 * variables `--pele-font` and `--pele-font-mono` where a theme sets them on
 * the element, else the element's own font and a monospace one.
 *
 * @param {?Window}     view    The window the element is in.
 * @param {HTMLElement} element The element the diagram is shown in.
 *
 * @return {{font: string, mono: string}} The font family of the labels (empty
 * when the element has none) and the monospace one.
 */
function getFonts( view, element ) {
	const style = view ? view.getComputedStyle( element ) : null;

	return {
		font:
			( style && style.getPropertyValue( '--pele-font' ).trim() ) ||
			( style && style.fontFamily ) ||
			'',
		mono:
			( style && style.getPropertyValue( '--pele-font-mono' ).trim() ) ||
			'monospace',
	};
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
 * This is the one place Pele's options are put together: the site's, which
 * the server tells the page (see `PeleOptions`), under the plugin's own.
 *
 * `draw()` lays a diagram out for the content width of `element`, so Pele can
 * turn a wide one vertical on a narrow screen. An element with no width gets
 * the full layout: see withFullLayout() in full-layout.js.
 *
 * @param {Object}                 pele                The Pele module: the lazy build's, or the
 *                                                     single-file build's.
 * @param {Object}                 [options]           Options.
 * @param {Document}               [options.doc]       The document of the window Pele runs in.
 * @param {Object}                 [options.measurer]  Measures text, where the browser's
 *                                                     canvas can't: see Pele's `TextMeasurer`.
 * @param {Object}                 [options.site]      Pele's render options for the site. The
 *                                                     options the plugin sets win over them.
 * @param {Object<string, string>} [options.iconPacks] The URL of the Iconify
 *                                                     JSON of each icon pack the site
 *                                                     registered, by name. A pack is fetched
 *                                                     for the first diagram that names one of
 *                                                     its icons.
 * @param {Function}               [options.loadMath]  Returns a promise of the math module
 *                                                     (`typeset()` of frontend/math.js). Called
 *                                                     once, for the first diagram with a
 *                                                     formula: no other loads it.
 *
 * @return {{name: string, document: Document, draw: Function, parse: Function, getStyle: Function, forgetTextWidths: Function, enableZoom: Function}}
 * The renderer.
 */
export function createPeleRenderer(
	pele,
	{ doc = document, measurer, site, loadMath, iconPacks } = {}
) {
	let mathModule = null;
	const icons = iconPacks ? createIcons( iconPacks ) : null;

	/**
	 * Loads the math module, once. A module that fails to load is logged, and
	 * diagrams are drawn without math: a label shows the TeX it was written in.
	 *
	 * @return {Promise<?Object>} The module, or null.
	 */
	const getMath = () => {
		if ( ! mathModule ) {
			mathModule = Promise.resolve()
				.then( loadMath )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error(
						'Mermaid Blocks: failed to load the math module.',
						error
					);

					return null;
				} );
		}

		return mathModule;
	};

	/**
	 * Renders with the icons of the site's packs. The resolver Pele calls is
	 * synchronous, so a pack that isn't loaded yet is loaded after a first
	 * drawing that notes the names asked for, and the diagram is drawn again:
	 * only then.
	 *
	 * @param {string} code    The Mermaid source.
	 * @param {Object} options Pele's options.
	 *
	 * @return {Promise<Object>} Pele's result.
	 */
	const renderWithIcons = async ( code, options ) => {
		if ( ! icons ) {
			delete options.icons;

			return pele.render( code, options );
		}

		const asked = new Set();

		options.icons = ( name ) => {
			asked.add( name );

			return icons.get( name );
		};

		const result = pele.render( code, options );

		if ( ! icons.hasUnloaded( asked ) ) {
			return result;
		}

		await icons.load( asked );

		return pele.render( code, options );
	};

	return {
		name: 'pele',
		document: doc,

		/**
		 * Makes Pele measure text again, as it must when a web font has
		 * loaded: what it measured was measured in the font before it.
		 */
		forgetTextWidths() {
			if ( typeof pele.forgetTextWidths === 'function' ) {
				pele.forgetTextWidths();
			}
		},

		/**
		 * Makes an element zoomable with Pele's zoom, which works on the SVG
		 * that is the first child of the element. The controls are in a bundle
		 * that imports no Pele, so they get it from here.
		 *
		 * @param {HTMLElement} element The element that holds the SVG.
		 * @param {Object}      options Pele's zoom options.
		 *
		 * @return {Object} Pele's zoom: `reset()`, `refresh()`, `destroy()`.
		 */
		enableZoom: ( element, options ) => pele.enableZoom( element, options ),

		async draw( code, theme, element, id ) {
			try {
				await loadType( pele, code );

				const view = element.ownerDocument.defaultView;
				const { font, mono } = getFonts( view, element );
				const width = getContentWidth( element );
				const options = {
					...site,
					idPrefix: id,
					responsive: true,
					fontFamilyMono: mono,
				};

				// The layout for the room the element has, which may turn a wide
				// diagram vertical (Pele's `autoDirection`). An element with no
				// width, as one that is hidden or off the page, gets the full layout.
				if ( width ) {
					options.maxWidth = width;
				} else {
					delete options.maxWidth;
				}

				if ( font ) {
					options.fontFamily = font;
				}

				if ( measurer ) {
					options.measurer = measurer;
				}

				// Temml, for a diagram that has a formula. The formula is measured
				// in the document of the diagram, which in the editor is the canvas.
				const typesetter =
					loadMath && code.includes( '$$' ) ? await getMath() : null;

				if ( typesetter ) {
					options.math = ( tex, size ) =>
						typesetter.typeset( tex, size, element.ownerDocument );
				} else {
					delete options.math;
				}

				const { svg } = await renderWithIcons( code, options );

				return { svg: withId( withFont( svg, font ), id ) };
			} catch ( error ) {
				return normaliseError( error, code );
			}
		},

		/**
		 * Returns the palette of a diagram, as the CSS variables Pele's SVG
		 * reads, for the element that holds it: a diagram changes palette
		 * without being drawn again.
		 *
		 * @param {string}       code    The Mermaid source.
		 * @param {string}       theme   What the diagram is drawn in.
		 * @param {?HTMLElement} element The element the diagram is shown in,
		 *                               whose surface the label boxes take, or
		 *                               null for one that isn't on a page.
		 *
		 * @return {Object<string, string>} The value of each variable.
		 */
		getStyle: ( code, theme, element ) =>
			getPaletteVariables(
				getPaletteName( theme, code ),
				element ? getSurface( element ) : null
			),

		async parse( code ) {
			try {
				await loadType( pele, code );

				// The limits and the default configuration of the site, as draw() has them.
				const { limit, maxEdges, config } = site || {};

				return {
					type: pele.parse( code, { limit, maxEdges, config } )
						.mermaidType,
				};
			} catch ( error ) {
				return normaliseError( error, code );
			}
		},
	};
}
