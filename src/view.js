/**
 * Renders Mermaid diagrams on the front end: the block's, and those of any
 * other integration that outputs the same markup (see includes/diagram.php).
 * Registered as the `mermaid-blocks-diagram` script.
 *
 * Each diagram renders when it scrolls into view, and Mermaid is loaded when
 * the first one does, so a page whose diagrams are never seen never loads it.
 * A diagram inside a hidden element, such as a closed tab, renders when it is
 * shown, at its real size.
 *
 * Also exposes `window.mermaidBlocks.render( element )` for diagrams added to
 * the page after it loaded, such as a widget a page builder re-renders.
 */
import renderDiagrams, { findDiagrams } from './frontend/render-diagrams';
import loadMermaid from './frontend/load-mermaid';

// Start a viewport's height ahead, so a diagram is usually rendered by the
// time it scrolls into view.
const ROOT_MARGIN = '100% 0px';

// Printed before this script by includes/diagram.php.
const { mermaidUrl } = window.mermaidBlocksSettings || {};

/**
 * Loads Mermaid if needed, and renders one diagram.
 *
 * @param {HTMLElement} diagram The diagram element.
 *
 * @return {Promise<void>} Resolves when the diagram has been processed.
 */
function renderNow( diagram ) {
	return loadMermaid( mermaidUrl )
		.then( ( mermaid ) => renderDiagrams( mermaid, diagram ) )
		.catch( ( error ) => {
			diagram.classList.add( 'has-error' );
			// eslint-disable-next-line no-console
			console.error( 'Mermaid Blocks: failed to render diagram.', error );
		} )
		.then( () => diagram.classList.remove( 'is-pending' ) );
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
	if ( ! mermaidUrl ) {
		// eslint-disable-next-line no-console
		console.warn(
			'Mermaid Blocks: the URL of Mermaid is missing. Mermaid diagrams will not be rendered.'
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
