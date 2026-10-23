/**
 * Shared Mermaid configuration (same as the front end).
 */
import MERMAID_CONFIG from '../utils/mermaid-config';
import { createMermaidRenderer } from './mermaid';
import { createPeleRenderer } from './pele';

/**
 * The renderers made for each loaded library, so a window always gets the
 * same one, and Mermaid is initialised once.
 *
 * @type {WeakMap<Object, Object>}
 */
const renderers = new WeakMap();

/**
 * Returns the library a window loaded: Pele's single-file build (the global
 * `pele`) or Mermaid.js (`mermaid`). The editor loads the site's renderer
 * and not the other.
 *
 * @param {Window} [view] The window.
 *
 * @return {Object|null} The library, or null when the window has none.
 */
function getLibrary( view ) {
	return ( view && ( view.pele || view.mermaid ) ) || null;
}

/**
 * Tells whether a window has loaded a renderer of its own.
 *
 * @param {Window} view The window.
 *
 * @return {boolean} Whether it has.
 */
export function hasRenderer( view ) {
	return !! getLibrary( view );
}

/**
 * Returns the renderer to draw an editor preview with.
 *
 * The editor canvas is an iframe that loads its own copy of the renderer, so a
 * diagram is measured in the same document it is displayed in, as on the front
 * end. Editors that are not iframed fall back to the copy in the admin window.
 *
 * @param {Window} [view] The window the preview is displayed in.
 *
 * @return {{name: string, document: Document, draw: Function, parse: Function}|null}
 * The renderer, which also tells the document it draws in, or null when none
 * is loaded.
 */
export function getRenderer( view ) {
	const owner = hasRenderer( view ) ? view : window;
	const library = getLibrary( owner );

	if ( ! library ) {
		return null;
	}

	if ( ! renderers.has( library ) ) {
		if ( owner.pele ) {
			renderers.set(
				library,
				createPeleRenderer( library, { doc: owner.document } )
			);
		} else {
			library.initialize( MERMAID_CONFIG );
			renderers.set(
				library,
				createMermaidRenderer( library, owner.document )
			);
		}
	}

	return renderers.get( library );
}
