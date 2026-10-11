/**
 * Mermaid configuration shared by the front end and the editor preview, so a
 * diagram renders the same way in both.
 *
 * @see https://mermaid.js.org/config/schema-docs/config.html
 */
const MERMAID_CONFIG = {
	// Blocks are rendered explicitly; never scan the page on load.
	startOnLoad: false,
};

export default MERMAID_CONFIG;
