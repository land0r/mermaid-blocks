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
	document.addEventListener( 'DOMContentLoaded', () => {
		// Initialize Mermaid globally
		if ( typeof mermaid !== 'undefined' ) {
			// eslint-disable-next-line no-undef
			mermaid.initialize( { startOnLoad: false } );

			const mermaidBlocks = document.querySelectorAll(
				'.wp-block-mermaid-blocks-diagram[data-mermaid]'
			);

			mermaidBlocks.forEach( async ( block, index ) => {
				// Get the MermaidJS code from the `data-mermaid` attribute
				const code = block.getAttribute( 'data-mermaid' );

				// Generate a unique ID for rendering
				const renderId = `mermaid-diagram-${ index + 1 }`;

				// Set or update the block's `id` attribute
				if ( ! block.hasAttribute( 'id' ) ) {
					block.setAttribute( 'id', renderId );
				}

				// Clear the block's content and prepare for rendering
				let renderContainer =
					block.querySelector( '.mermaid-container' );
				if ( ! renderContainer ) {
					renderContainer = document.createElement( 'div' );
					renderContainer.className = 'mermaid-container';
					renderContainer.id = `diagram-body-${ index }`;
				}

				try {
					// Render the Mermaid diagram
					// eslint-disable-next-line no-undef
					const { svg, bindFunctions } = await mermaid.render(
						'render-' + index,
						code
					);

					// Inject the rendered SVG into the container
					renderContainer.innerHTML = svg;

					// Bind interactivity functions if present
					bindFunctions?.( renderContainer );

					block.innerHTML = svg;
				} catch ( error ) {
					// Log errors and display a fallback message
					// eslint-disable-next-line no-console
					console.error( 'Mermaid rendering failed:', error );
					renderContainer.innerHTML =
						'<p>Mermaid rendering failed. Check your syntax.</p>';
				}
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
