import loadMermaid from './load-mermaid';
import { createMermaidRenderer } from '../renderers/mermaid';

let loading = null;

/**
 * Loads the renderer the page draws its diagrams with, once per page.
 *
 * @param {string} mermaidUrl URL of `build/mermaid/mermaid.esm.min.js`.
 *
 * @return {Promise<Object>} The renderer: see createMermaidRenderer(). Rejects
 * when it could not be loaded.
 */
export default function loadRenderer( mermaidUrl ) {
	if ( ! loading ) {
		loading = loadMermaid( mermaidUrl ).then( createMermaidRenderer );
	}

	return loading;
}
