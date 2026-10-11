/**
 * Shared Mermaid configuration (same as the front end).
 */
import MERMAID_CONFIG from './mermaid-config';

/**
 * Mermaid instances that have already been initialised. Each window that loads
 * the library (the admin page and the editor canvas iframe) has its own.
 *
 * @type {WeakSet<Object>}
 */
const initialized = new WeakSet();

/**
 * Returns the Mermaid instance to render an editor preview with, initialised
 * with the front-end configuration.
 *
 * The editor canvas is an iframe that loads its own copy of Mermaid, so a
 * diagram is measured in the same document it is displayed in, as on the front
 * end. Editors that are not iframed fall back to the copy in the admin window.
 *
 * @param {Window} [view] The window the preview is displayed in.
 *
 * @return {{mermaid: Object, document: Document}|null} The Mermaid instance and
 * the document it renders in, or null when Mermaid is not loaded.
 */
export function getMermaid( view ) {
	const owner = view && view.mermaid ? view : window;
	const { mermaid } = owner;

	if ( ! mermaid ) {
		return null;
	}

	if ( ! initialized.has( mermaid ) ) {
		mermaid.initialize( MERMAID_CONFIG );
		initialized.add( mermaid );
	}

	return { mermaid, document: owner.document };
}
