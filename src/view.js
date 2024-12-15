/**
 * This file contains JavaScript code to render MermaidJS diagrams dynamically
 * on the front end of posts or pages containing this block.
 *
 * When this file is specified as the value of the `viewScript` property in
 * `block.json`, it will be enqueued automatically on the front end.
 *
 * Example:
 * {
 *   "viewScript": "file:./view.js"
 * }
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#view-script
 */

// Check if the MermaidJS library is available globally
if ( typeof mermaid !== 'undefined' ) {
	// Wait for the DOM to load
	document.addEventListener( 'DOMContentLoaded', async () => {
		// Initialize Mermaid globally
		if ( typeof mermaid !== 'undefined' ) {
			// eslint-disable-next-line no-undef
			mermaid.initialize( { startOnLoad: false } );

			await mermaid.run( {
				querySelector: '.wp-block-mermaid-blocks-diagram',
			} );
		} else {
			// eslint-disable-next-line no-console
			console.warn(
				'Mermaid.js library is not available. Mermaid blocks will not be rendered.'
			);
		}
	} );
} else {
	// Log a warning if Mermaid.js is not loaded
	// eslint-disable-next-line no-console
	console.warn(
		'Mermaid.js library is not available. Mermaid blocks will not be rendered.'
	);
}
