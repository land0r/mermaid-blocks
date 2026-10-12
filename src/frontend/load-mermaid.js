import MERMAID_CONFIG from '../utils/mermaid-config';

let loading = null;

/**
 * Loads Mermaid's ES module build once per page, and initialises it with the
 * shared configuration.
 *
 * The build loads the code of each diagram type the first time a diagram of
 * that type renders, so a page only downloads the types it shows. It is
 * imported by URL at runtime, never bundled.
 *
 * @param {string} url URL of `build/mermaid/mermaid.esm.min.js`.
 *
 * @return {Promise<Object>} The Mermaid API object. Rejects, on every call,
 * when Mermaid could not be loaded.
 */
export default function loadMermaid( url ) {
	if ( ! loading ) {
		loading = import( /* webpackIgnore: true */ url ).then(
			( { default: mermaid } ) => {
				mermaid.initialize( MERMAID_CONFIG );
				return mermaid;
			}
		);
	}

	return loading;
}
