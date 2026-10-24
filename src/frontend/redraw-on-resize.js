import { redrawInPlace } from './render-diagrams';
import watchWidth from '../utils/watch-width';

const CANVAS_SELECTOR = '.mermaid-blocks-diagram__canvas';

// The canvases being watched: a canvas is watched once.
const watched = new WeakSet();

/**
 * Draws a rendered Pele diagram again when the width of its canvas changes:
 * a resized window, a rotated phone, fullscreen in and out. Pele lays a
 * diagram out for the width it is drawn for, and may turn it vertical.
 *
 * The canvas, its toolbar and its palette stay (see redrawInPlace()), and a
 * change of the canvas's height is not a reason to draw again. Mermaid.js
 * diagrams are not watched: they are as wide as the page lets them be, and
 * draw the same whatever the width.
 *
 * @param {Object}      renderer Draws the diagram.
 * @param {HTMLElement} diagram  The rendered diagram element.
 */
export default function redrawOnResize( renderer, diagram ) {
	const canvas = diagram.querySelector( CANVAS_SELECTOR );

	if ( renderer.name !== 'pele' || ! canvas || watched.has( canvas ) ) {
		return;
	}

	watched.add( canvas );

	watchWidth( canvas, () =>
		redrawInPlace( renderer, diagram ).then(
			( redrawn ) => {
				// Where Pele's zoom is refreshed for the new drawing, once a
				// diagram has one.
				return redrawn;
			},
			( error ) => {
				// eslint-disable-next-line no-console
				console.error(
					'Mermaid Blocks: failed to render diagram.',
					error
				);

				return false;
			}
		)
	);
}
