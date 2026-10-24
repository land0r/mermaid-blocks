/**
 * The full layout of a Pele diagram, for the files made from it.
 *
 * On a page, Pele lays a diagram out for the width it has (`maxWidth`) and may
 * turn it vertical on a narrow screen. A downloaded file, a copied image and a
 * saved image are the same on every screen: the full layout, which a wide
 * screen gets. So they are not made from the SVG on the page.
 */
import { getAccessibleText, setAccessibleText } from './accessible-text';

/**
 * Hands a hidden element in `parent` to `callback`, and removes it once that
 * is done. A diagram drawn for it gets the full layout: it has no width, so
 * the renderer gives Pele no `maxWidth`, and it inherits the fonts and the
 * `--pele-*` variables of `parent`.
 *
 * @param {HTMLElement} parent   Where the diagram's styles come from.
 * @param {Function}    callback Called with the hidden element. Returns what
 *                               the caller wants back, or a promise of it.
 *
 * @return {Promise<*>} What `callback` returned.
 */
export async function inHiddenElement( parent, callback ) {
	const element = parent.ownerDocument.createElement( 'div' );

	element.hidden = true;
	element.style.display = 'none';
	parent.appendChild( element );

	try {
		return await callback( element );
	} finally {
		element.remove();
	}
}

/**
 * Draws a diagram in its full layout, and hands it on for as long as `use`
 * takes. Where the renderer is not Pele's, the SVG on the page is handed on:
 * Mermaid.js does not lay out for a width.
 *
 * The drawing is made for a hidden element inside the one that holds the SVG
 * on the page (see inHiddenElement()), so it has the diagram's fonts and
 * variables, which `getSvgMarkup()` writes into the file. If the drawing
 * fails, the SVG on the page is used.
 *
 * @param {?Object}       renderer The renderer the diagram is drawn with: see
 *                                 createPeleRenderer().
 * @param {SVGSVGElement} svg      The diagram on the page.
 * @param {string}        code     The Mermaid source of the diagram.
 * @param {string}        theme    What the diagram is drawn in.
 * @param {Function}      use      Called with the SVG to make the file from,
 *                                 which is only there while it runs. Returns
 *                                 what the caller wants back, or a promise of
 *                                 it.
 *
 * @return {Promise<*>} What `use` returned.
 */
export async function withFullLayout( renderer, svg, code, theme, use ) {
	if ( ! renderer || renderer.name !== 'pele' || ! svg.parentElement ) {
		return use( svg );
	}

	return inHiddenElement( svg.parentElement, async ( probe ) => {
		const result = await renderer.draw(
			code,
			theme,
			probe,
			`${ svg.id || 'mermaid-blocks-diagram' }-full`
		);

		if ( ! result.error ) {
			probe.innerHTML = result.svg;
		}

		const full = probe.querySelector( 'svg' );

		// The title and description the page gave the diagram, for the file too.
		if ( full ) {
			setAccessibleText( full, getAccessibleText( svg ) );
		}

		return use( full || svg );
	} );
}

/**
 * Returns what makes a file from a diagram in its full layout: the argument
 * the download and copy functions of export-diagram.js take.
 *
 * @param {?Object}       renderer The renderer the diagram is drawn with.
 * @param {SVGSVGElement} svg      The diagram on the page.
 * @param {Function}      getCode  Returns the Mermaid source of the diagram.
 * @param {Function}      getTheme Returns what the diagram is drawn in.
 *
 * @return {Function} Given `use`, as withFullLayout() takes it, calls it with
 * the SVG to make the file from.
 */
export function createFullLayout( renderer, svg, getCode, getTheme ) {
	return ( use ) =>
		withFullLayout( renderer, svg, getCode(), getTheme(), use );
}
