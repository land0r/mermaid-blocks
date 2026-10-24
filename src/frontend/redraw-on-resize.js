import { redrawInPlace } from './render-diagrams';
import watchWidth from '../utils/watch-width';

const CANVAS_SELECTOR = '.mermaid-blocks-diagram__canvas';

// The diagrams being watched: a diagram is watched once.
const watched = new WeakSet();

/**
 * Draws a rendered Pele diagram again when its width changes: a resized
 * window, a rotated phone, fullscreen in and out. Pele lays a diagram out for
 * the width of the diagram element it is drawn for (see `draw()` of the Pele
 * renderer), so that is the width watched, not the canvas's: a theme may pad
 * the one and not the other.
 *
 * The canvas, its toolbar and its palette stay (see redrawInPlace()), and a
 * change of the diagram's height is not a reason to draw again. Mermaid.js
 * diagrams are not watched: they are as wide as the page lets them be, and
 * draw the same whatever the width.
 *
 * @param {Object}      renderer Draws the diagram.
 * @param {HTMLElement} diagram  The rendered diagram element.
 */
export default function redrawOnResize( renderer, diagram ) {
	if (
		renderer.name !== 'pele' ||
		! diagram.querySelector( CANVAS_SELECTOR ) ||
		watched.has( diagram )
	) {
		return;
	}

	watched.add( diagram );

	watchWidth( diagram, () =>
		redrawInPlace( renderer, diagram ).catch( ( error ) => {
			// eslint-disable-next-line no-console
			console.error( 'Mermaid Blocks: failed to render diagram.', error );

			return false;
		} )
	);
}
