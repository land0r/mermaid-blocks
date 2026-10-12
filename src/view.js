/**
 * Renders Mermaid diagrams on the front end: the block's, and those of any
 * other integration that outputs the same markup (see includes/diagram.php).
 * Registered as the `mermaid-blocks-diagram` script, after the `mermaid-js`
 * library.
 *
 * Also exposes `window.mermaidBlocks.render( element )` for diagrams added to
 * the page after it loaded, such as a widget a page builder re-renders.
 */
import renderDiagrams from './frontend/render-diagrams';
import { getMermaid } from './utils/mermaid-init';

/**
 * Renders the diagrams under `root` that have not been rendered yet.
 *
 * @param {Document|HTMLElement} [root] Where to look for diagrams.
 *
 * @return {Promise<void>} Resolves when all diagrams have been processed.
 */
function render( root = document ) {
	const doc = root.ownerDocument || root;
	const owner = getMermaid( doc.defaultView );

	if ( ! owner ) {
		// eslint-disable-next-line no-console
		console.warn(
			'Mermaid.js library is not available. Mermaid diagrams will not be rendered.'
		);
		return Promise.resolve();
	}

	return renderDiagrams( owner.mermaid, root, owner.document );
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
