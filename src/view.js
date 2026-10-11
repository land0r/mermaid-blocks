/**
 * Renders MermaidJS diagrams on the front end of posts or pages containing
 * the block. Enqueued automatically through the `viewScript` property in
 * block.json, after the global `mermaid` library.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#view-script
 */
import renderBlocks from './frontend/render-blocks';
import MERMAID_CONFIG from './utils/mermaid-config';

async function init() {
	const mermaid = window.mermaid;

	if ( ! mermaid ) {
		// eslint-disable-next-line no-console
		console.warn(
			'Mermaid.js library is not available. Mermaid blocks will not be rendered.'
		);
		return;
	}

	mermaid.initialize( MERMAID_CONFIG );
	await renderBlocks( mermaid );
}

// The script may execute after DOMContentLoaded (deferred/delayed by
// optimisation plugins), so do not rely on the event alone.
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init, { once: true } );
} else {
	init();
}
