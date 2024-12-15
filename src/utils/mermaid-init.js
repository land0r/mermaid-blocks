/**
 * DOM Ready utility for WordPress.
 * Ensures the provided callback runs once the DOM is fully loaded.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-dom-ready/
 */
import domReady from '@wordpress/dom-ready';

/**
 * Initializes Mermaid.js globally.
 *
 * This function ensures that Mermaid.js is initialized only once during the
 * lifetime of the application. If Mermaid.js is not available on the global
 * `window` object, it silently exits. A custom `isInitialized` flag is used to
 * prevent redundant initializations.
 *
 * @see https://mermaid-js.github.io/mermaid/#/Setup
 */
export function initializeMermaid() {
	try {
		// Check if Mermaid.js is loaded globally
		if ( typeof window.mermaid === 'undefined' ) {
			// Mermaid.js is not loaded, silently exit
			return;
		}

		// Check if Mermaid has already been initialized
		if ( ! window.mermaid.isInitialized ) {
			// Initialize Mermaid.js with default options
			window.mermaid.initialize( {
				startOnLoad: false, // Disable auto-rendering on page load  securityLevel: 'loose',
				htmlLabels: false, // Fix incompatibility with Gutenberg.
				flowchart: {
					htmlLabels: false, // Fix incompatibility with Gutenberg.
				},
			} );

			// Mark Mermaid as initialized to avoid re-initialization
			window.mermaid.isInitialized = true;
		}
	} catch ( error ) {
		// Log the error to the console for debugging
		// eslint-disable-next-line no-console
		console.error( 'Error during Mermaid.js initialization:', error );
	}
}

/**
 * Executes Mermaid.js initialization when the DOM is fully loaded.
 * This ensures that Mermaid is set up after all elements in the DOM are available.
 */
domReady( () => {
	initializeMermaid();
} );
