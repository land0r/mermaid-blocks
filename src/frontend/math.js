/**
 * Typesets the formulas of Pele diagrams.
 *
 * Pele draws `$$…$$` in a label with a `math` function the page gives it. This
 * one is Temml's, which writes MathML: the browser draws it with its own math
 * font, so no fonts or CSS ship with it. It is a file of its own
 * (`build/math.js`, a module), imported by URL when a diagram has a formula:
 * see src/renderers/pele.js.
 */
import temml from 'temml';

/**
 * Returns the size of some MathML as the browser lays it out, measured in a
 * hidden element in the document the diagram is drawn in, whose fonts and CSS
 * are the ones the formula is shown with.
 *
 * @param {string}   html The MathML.
 * @param {number}   size The font size, in pixels.
 * @param {Document} doc  The document of the diagram.
 *
 * @return {{width: number, height: number}} The size, in pixels.
 */
function measure( html, size, doc ) {
	const probe = doc.createElement( 'span' );

	probe.style.cssText =
		'position:absolute;visibility:hidden;display:inline-block;white-space:nowrap;';
	probe.style.fontSize = `${ size }px`;
	probe.innerHTML = html;
	doc.body.appendChild( probe );

	try {
		const { width, height } = (
			probe.querySelector( 'math' ) || probe
		).getBoundingClientRect();

		return { width, height };
	} finally {
		probe.remove();
	}
}

/**
 * Typesets a formula.
 *
 * @param {string}   tex  The TeX between the `$$`.
 * @param {number}   size The font size of the label, in pixels.
 * @param {Document} doc  The document the diagram is drawn in, which may be
 *                        the editor canvas's: the formula is measured there.
 *
 * @return {?{html: string, width: number, height: number}} The MathML and its
 * size, or null when Temml can't parse the TeX, so the label shows the source.
 */
export function typeset( tex, size, doc ) {
	let html;

	try {
		html = temml.renderToString( tex, {
			displayMode: true,
			throwOnError: true,
		} );
	} catch ( error ) {
		return null;
	}

	return { html, ...measure( html, size, doc ) };
}
