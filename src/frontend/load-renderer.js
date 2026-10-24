import loadMermaid from './load-mermaid';
import { createMermaidRenderer } from '../renderers/mermaid';
import { createPeleRenderer } from '../renderers/pele';

let loading = null;

/**
 * Imports Pele's lazy build by URL at runtime, never bundled. Its entry loads
 * the code of each diagram type the first time a diagram of that type is drawn.
 *
 * @param {string} url URL of `build/pele/lazy.js`.
 *
 * @return {Promise<Object>} The Pele module.
 */
function loadPele( url ) {
	return import( /* webpackIgnore: true */ url );
}

/**
 * Loads the renderer the page draws its diagrams with, once per page: Pele
 * when the settings name it, and Mermaid.js for anything else, such as a page
 * cached before there was a choice. A page loads one renderer, never both.
 *
 * @param {Object} settings               What the page is told: see `Assets`.
 * @param {string} settings.renderer      `pele`, or `mermaid`.
 * @param {string} settings.mermaidUrl    URL of `build/mermaid/mermaid.esm.min.js`.
 * @param {string} settings.peleUrl       URL of `build/pele/lazy.js`.
 * @param {Object} [settings.peleOptions] Pele's render options for the site.
 *
 * @return {Promise<Object>} The renderer: see createMermaidRenderer(). Rejects
 * when it could not be loaded.
 */
export default function loadRenderer( settings ) {
	const { renderer, mermaidUrl, peleUrl } = settings;

	if ( ! loading ) {
		loading =
			renderer === 'pele'
				? loadPele( peleUrl ).then( ( pele ) =>
						createPeleRenderer( pele, {
							site: settings.peleOptions,
						} )
				  )
				: loadMermaid( mermaidUrl ).then( createMermaidRenderer );
	}

	return loading;
}

/**
 * Tells which URL a page needs to draw its diagrams.
 *
 * @param {Object} settings            What the page is told: see loadRenderer().
 * @param {string} settings.renderer   `pele`, or `mermaid`.
 * @param {string} settings.mermaidUrl URL of Mermaid.js.
 * @param {string} settings.peleUrl    URL of Pele.
 *
 * @return {string|undefined} The URL of the renderer the settings name.
 */
export function getRendererUrl( { renderer, mermaidUrl, peleUrl } ) {
	return renderer === 'pele' ? peleUrl : mermaidUrl;
}
