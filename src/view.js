/**
 * Renders Mermaid diagrams on the front end: the block's, and those of any
 * other integration that outputs the same markup (see includes/Diagram.php).
 * Registered as the `mermaid-blocks-diagram` script.
 *
 * Each diagram renders when it scrolls into view, and the renderer (Mermaid.js
 * or Pele) is loaded when the first one does, so a page whose diagrams are
 * never seen never loads it.
 * A diagram inside a hidden element, such as a closed tab, renders when it is
 * shown, at its real size. Once rendered, a diagram gets the controls its
 * markup asks for: zoom, download, copy, fullscreen. Their code is loaded when
 * the first diagram asks for one. A diagram that follows the page is drawn
 * again, in the other theme, when the page turns dark or light.
 *
 * Also exposes `window.mermaidBlocks.render( element )` for diagrams added to
 * the page after it loaded, such as a widget a page builder re-renders.
 */
import renderDiagrams, {
	findDiagrams,
	isOutdated,
	redrawDiagram,
} from './frontend/render-diagrams';
import loadRenderer, { getRendererUrl } from './frontend/load-renderer';
import loadControls from './frontend/load-controls';
import watchSurface from './utils/watch-surface';

// Start a viewport's height ahead, so a diagram is usually rendered by the
// time it scrolls into view.
const ROOT_MARGIN = '100% 0px';

// Printed before this script by includes/Assets.php.
const settings = window.mermaidBlocksSettings || {};
const { mermaidUrl, controlsUrl, i18n } = settings;

// Whether the page is watched for turning dark or light.
let watching = false;

/**
 * Returns the URL of the controls: `build/controls.js`.
 *
 * A page that was cached before the controls became a file of their own
 * doesn't say where it is, but it does say where Mermaid is: in `build/` too.
 *
 * @return {string} The URL.
 */
function getControlsUrl() {
	return (
		controlsUrl ||
		new URL( '../controls.js', new URL( mermaidUrl, document.baseURI ) )
			.href
	);
}

/**
 * Gives a rendered diagram the controls its markup asks for, and loads their
 * code first. A diagram that asks for none loads nothing.
 *
 * @param {HTMLElement} diagram The diagram element.
 */
function addControls( diagram ) {
	if (
		! diagram.classList.contains( 'is-rendered' ) ||
		! ( diagram.dataset.mermaidControls || '' ).trim()
	) {
		return;
	}

	loadControls( getControlsUrl() )
		.then( ( add ) => add( diagram, i18n ) )
		.catch( ( error ) => {
			// eslint-disable-next-line no-console
			console.error(
				'Mermaid Blocks: failed to load the controls of diagrams.',
				error
			);
		} );
}

/**
 * Draws again the rendered diagrams that are in another theme than the one
 * they would get now, and gives them their controls back.
 */
function redrawOutdated() {
	findDiagrams( document )
		.filter( isOutdated )
		.forEach( ( diagram ) => {
			loadRenderer( settings )
				.then( ( renderer ) => redrawDiagram( renderer, diagram ) )
				.then( ( redrawn ) => {
					if ( redrawn ) {
						addControls( diagram );
					}
				} )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error(
						'Mermaid Blocks: failed to render diagram.',
						error
					);
				} );
		} );
}

/**
 * Loads the renderer if needed, renders one diagram and adds its controls.
 *
 * @param {HTMLElement} diagram The diagram element.
 *
 * @return {Promise<void>} Resolves when the diagram has been processed.
 */
function renderNow( diagram ) {
	return loadRenderer( settings )
		.then( ( renderer ) => renderDiagrams( renderer, diagram ) )
		.catch( ( error ) => {
			diagram.classList.add( 'has-error' );
			// eslint-disable-next-line no-console
			console.error( 'Mermaid Blocks: failed to render diagram.', error );
		} )
		.then( () => {
			diagram.classList.remove( 'is-pending' );
			addControls( diagram );

			if ( ! watching ) {
				watching = true;
				watchSurface( redrawOutdated );
			}
		} );
}

const observer =
	typeof window.IntersectionObserver === 'function'
		? new window.IntersectionObserver(
				( entries ) => {
					entries.forEach( ( entry ) => {
						if ( entry.isIntersecting ) {
							observer.unobserve( entry.target );
							renderNow( entry.target );
						}
					} );
				},
				{ rootMargin: ROOT_MARGIN }
		  )
		: null;

/**
 * Renders the diagrams under `root` as they scroll into view. Diagrams that
 * are rendered, or already waiting to scroll into view, are skipped.
 *
 * Diagrams are pending until they render: the `is-pending` class keeps their
 * source hidden (see style.scss).
 *
 * @param {Document|HTMLElement} [root] Where to look for diagrams, in the
 *                                      document of this script.
 */
function render( root = document ) {
	if ( ! getRendererUrl( settings ) ) {
		// eslint-disable-next-line no-console
		console.warn(
			'Mermaid Blocks: the URL of the renderer is missing. Mermaid diagrams will not be rendered.'
		);
		return;
	}

	findDiagrams( root )
		.filter(
			( diagram ) =>
				! diagram.matches( '.is-rendered, .has-error, .is-pending' )
		)
		.forEach( ( diagram ) => {
			diagram.classList.add( 'is-pending' );

			if ( observer ) {
				observer.observe( diagram );
			} else {
				renderNow( diagram );
			}
		} );
}

window.mermaidBlocks = { ...window.mermaidBlocks, render };

// The script may execute after DOMContentLoaded (deferred/delayed by
// optimisation plugins), so do not rely on the event alone.
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', () => render(), {
		once: true,
	} );
} else {
	render();
}
