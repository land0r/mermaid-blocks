/**
 * Shared Mermaid configuration (same as the front end).
 */
import MERMAID_CONFIG from '../utils/mermaid-config';
import { createMermaidRenderer } from './mermaid';

/**
 * The renderers made for each loaded library, so a window always gets the
 * same one, and Mermaid is initialised once.
 *
 * @type {WeakMap<Object, Object>}
 */
const renderers = new WeakMap();

/**
 * Tells whether a window has loaded a renderer of its own.
 *
 * @param {Window} view The window.
 *
 * @return {boolean} Whether it has.
 */
export function hasRenderer( view ) {
	return !! ( view && view.mermaid );
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
	const { mermaid } = owner;

	if ( ! mermaid ) {
		return null;
	}

	if ( ! renderers.has( mermaid ) ) {
		mermaid.initialize( MERMAID_CONFIG );
		renderers.set(
			mermaid,
			createMermaidRenderer( mermaid, owner.document )
		);
	}

	return renderers.get( mermaid );
}
