import { resolveTheme } from '../utils/themes';
import { setAccessibleText } from '../utils/accessible-text';
import { REDRAWN_EVENT } from '../utils/redrawn-event';

const DIAGRAM_SELECTOR = '.graphdraw-diagram';
const SOURCE_SELECTOR = '.graphdraw-diagram__source';
const CANVAS_SELECTOR = '.graphdraw-diagram__canvas';
const TOOLBAR_SELECTOR = '.graphdraw-diagram__toolbar';

let counter = 0;

/**
 * Finds the diagrams under `root`, and `root` itself when it is one.
 *
 * @param {Document|HTMLElement} root Where to look for diagrams.
 *
 * @return {HTMLElement[]} The diagram elements.
 */
export function findDiagrams( root ) {
	const diagrams = Array.from( root.querySelectorAll( DIAGRAM_SELECTOR ) );

	if ( root.matches && root.matches( DIAGRAM_SELECTOR ) ) {
		diagrams.unshift( root );
	}

	return diagrams;
}

/**
 * Tells whether a rendered diagram is drawn in another theme than the one it
 * would get now: it follows the page (see resolveTheme()), and the page went
 * dark or light since.
 *
 * @param {HTMLElement} diagram The diagram element.
 *
 * @return {boolean} Whether to draw the diagram again.
 */
export function isOutdated( diagram ) {
	const canvas = diagram.querySelector( CANVAS_SELECTOR );

	return (
		!! canvas &&
		canvas.dataset.mermaidTheme !==
			resolveTheme( diagram.dataset.mermaidTheme, diagram )
	);
}

/**
 * Gives the element that holds a diagram's SVG the style its renderer asks
 * for: see getStyle() of the renderers.
 *
 * @param {Object}      renderer The renderer the diagram is drawn with.
 * @param {HTMLElement} diagram  The diagram element.
 * @param {HTMLElement} canvas   The element that holds the SVG.
 * @param {string}      theme    What the diagram is drawn in.
 *
 * @return {boolean} Whether the renderer asks for one: a diagram that has one
 * changes colours with it, and is never drawn again for that.
 */
function setStyle( renderer, diagram, canvas, theme ) {
	const source = diagram.querySelector( SOURCE_SELECTOR );
	const style = renderer.getStyle( source.textContent, theme, diagram );

	Object.entries( style || {} ).forEach( ( [ property, value ] ) =>
		canvas.style.setProperty( property, value )
	);

	return !! style;
}

/**
 * Draws a diagram: in the theme its `data-mermaid-theme` attribute asks for,
 * with the accessible title and description of its `data-mermaid-title` and
 * `data-mermaid-description` attributes.
 *
 * @param {Object}      renderer The renderer to draw with.
 * @param {HTMLElement} diagram  The diagram element.
 * @param {HTMLElement} source   The element holding its source.
 *
 * @return {Promise<HTMLElement|null>} The element holding the SVG, which says
 * the theme it was drawn in, or null when the diagram failed to render.
 */
async function createCanvas( renderer, diagram, source ) {
	const theme = resolveTheme( diagram.dataset.mermaidTheme, diagram );

	counter += 1;

	const result = await renderer.draw(
		source.textContent,
		theme,
		diagram,
		`graphdraw-diagram-${ counter }`
	);

	if ( result.error ) {
		const { line, message } = result.error;

		// eslint-disable-next-line no-console
		console.error(
			'GraphDraw: failed to render diagram.',
			line === null ? message : `Line ${ line }: ${ message }`
		);

		return null;
	}

	const canvas = diagram.ownerDocument.createElement( 'div' );
	canvas.className = 'graphdraw-diagram__canvas';
	canvas.dataset.mermaidTheme = theme;
	canvas.innerHTML = result.svg;
	setStyle( renderer, diagram, canvas, theme );

	const svg = canvas.querySelector( 'svg' );

	if ( svg ) {
		setAccessibleText( svg, {
			title: diagram.dataset.mermaidTitle,
			description: diagram.dataset.mermaidDescription,
		} );
	}

	if ( typeof result.bindFunctions === 'function' ) {
		result.bindFunctions( canvas );
	}

	return canvas;
}

/**
 * Renders every not-yet-processed diagram under `root`: the block's, and any
 * other integration's that outputs the same markup (see includes/Diagram.php).
 *
 * @param {Object}               renderer Draws the diagrams.
 * @param {Document|HTMLElement} [root]   Where to look for diagrams.
 *
 * @return {Promise<void>} Resolves when all diagrams have been processed.
 */
export default async function renderDiagrams( renderer, root = document ) {
	for ( const diagram of findDiagrams( root ) ) {
		const source = diagram.querySelector( SOURCE_SELECTOR );

		if (
			! source ||
			diagram.classList.contains( 'is-rendered' ) ||
			diagram.classList.contains( 'has-error' ) ||
			diagram.dataset.mermaidProcessing
		) {
			continue;
		}

		diagram.dataset.mermaidProcessing = '1';

		const canvas = await createCanvas( renderer, diagram, source );

		if ( canvas ) {
			// In place of the source, so above a caption.
			source.after( canvas );
			source.hidden = true;
			diagram.classList.add( 'is-rendered' );
		} else {
			diagram.classList.add( 'has-error' );
		}

		delete diagram.dataset.mermaidProcessing;
	}
}

/**
 * Draws a rendered diagram again, in the theme it gets now. Its controls go
 * with the old drawing: add them again afterwards. A diagram whose renderer
 * gives it a style, as Pele does, isn't drawn again: it gets the style of the
 * theme in place, keeps its controls, and this resolves to false.
 *
 * The diagram stays as it is until the new drawing is ready, and when that
 * fails.
 *
 * @param {Object}      renderer Draws the diagram.
 * @param {HTMLElement} diagram  The diagram element.
 *
 * @return {Promise<boolean>} Whether the diagram was drawn again.
 */
export async function redrawDiagram( renderer, diagram ) {
	const source = diagram.querySelector( SOURCE_SELECTOR );
	const previous = diagram.querySelector( CANVAS_SELECTOR );

	if (
		! source ||
		! previous ||
		! diagram.classList.contains( 'is-rendered' ) ||
		diagram.dataset.mermaidProcessing
	) {
		return false;
	}

	const theme = resolveTheme( diagram.dataset.mermaidTheme, diagram );

	if ( setStyle( renderer, diagram, previous, theme ) ) {
		previous.dataset.mermaidTheme = theme;

		return false;
	}

	diagram.dataset.mermaidProcessing = '1';

	const canvas = await createCanvas( renderer, diagram, source );

	if ( canvas ) {
		const toolbar = diagram.querySelector( TOOLBAR_SELECTOR );

		if ( toolbar ) {
			toolbar.remove();
		}

		previous.replaceWith( canvas );
		diagram.classList.remove( 'is-zoomed', 'is-panning' );
	}

	delete diagram.dataset.mermaidProcessing;

	return !! canvas;
}

/**
 * Draws a rendered diagram again in place, when its renderer gives diagrams a
 * style, as Pele does: only the SVG changes. The canvas keeps its palette, and
 * the diagram its controls and zoom. A web font that loaded, or a canvas that
 * changed its width, are the reasons.
 *
 * The diagram stays as it is when the new drawing fails, and while a drawing
 * or a redraw is going on.
 *
 * @param {Object}      renderer Draws the diagram.
 * @param {HTMLElement} diagram  The diagram element.
 *
 * @return {Promise<boolean>} Whether the diagram was drawn again: not when it
 * isn't rendered, is being processed, or the renderer has no style for it.
 */
export async function redrawInPlace( renderer, diagram ) {
	const source = diagram.querySelector( SOURCE_SELECTOR );
	const canvas = diagram.querySelector( CANVAS_SELECTOR );
	const svg = canvas && canvas.querySelector( 'svg' );

	if (
		! source ||
		! svg ||
		! diagram.classList.contains( 'is-rendered' ) ||
		diagram.dataset.mermaidProcessing
	) {
		return false;
	}

	const theme = resolveTheme( diagram.dataset.mermaidTheme, diagram );

	if ( ! renderer.getStyle( source.textContent, theme, diagram ) ) {
		return false;
	}

	diagram.dataset.mermaidProcessing = '1';

	let redrawn = false;

	try {
		// The id stays, and so do the ids of the accessible title and description.
		const result = await renderer.draw(
			source.textContent,
			canvas.dataset.mermaidTheme,
			diagram,
			svg.id
		);

		if ( ! result.error ) {
			replaceSvg( svg, result.svg );
			setAccessibleText( svg, {
				title: diagram.dataset.mermaidTitle,
				description: diagram.dataset.mermaidDescription,
			} );
			redrawn = true;

			// The controls are in a bundle of their own: the zoom of Pele reads
			// the new drawing again when it hears of it.
			diagram.dispatchEvent( new CustomEvent( REDRAWN_EVENT ) );
		}
	} finally {
		delete diagram.dataset.mermaidProcessing;
	}

	return redrawn;
}

/**
 * Puts a new drawing in the place of an SVG element, in the same element, so
 * what refers to it, such as the zoom, still does.
 *
 * @param {SVGSVGElement} svg    The element on the page.
 * @param {string}        markup The new drawing.
 */
function replaceSvg( svg, markup ) {
	const template = svg.ownerDocument.createElement( 'template' );
	template.innerHTML = markup;

	const next = template.content.querySelector( 'svg' );

	if ( ! next ) {
		return;
	}

	Array.from( svg.attributes ).forEach( ( { name } ) =>
		svg.removeAttribute( name )
	);
	Array.from( next.attributes ).forEach( ( { name, value } ) =>
		svg.setAttribute( name, value )
	);
	svg.replaceChildren( ...Array.from( next.childNodes ) );
}
