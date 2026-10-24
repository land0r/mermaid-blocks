let loading = null;

/**
 * Loads the math module once per page: Temml, which typesets the formulas of
 * Pele diagrams.
 *
 * Most diagrams have none, so it is a file of its own (`build/math.js`, a
 * module), imported by URL when the first diagram with a formula is drawn.
 *
 * @param {string} url URL of `build/math.js`.
 *
 * @return {Promise<Object>} The module, with `typeset()`. Rejects, on every
 * call, when the file could not be loaded.
 */
export default function loadMath( url ) {
	if ( ! loading ) {
		loading = import( /* webpackIgnore: true */ url );
	}

	return loading;
}

/**
 * Returns the URL of the math module: `build/math.js`.
 *
 * A page that was cached before the module existed doesn't say where it is,
 * but it does say where Pele is: in `build/` too.
 *
 * @param {Object} settings         What the page is told: see `Assets`.
 * @param {string} settings.mathUrl URL of `build/math.js`.
 * @param {string} settings.peleUrl URL of `build/pele/lazy.js`.
 *
 * @return {string} The URL.
 */
export function getMathUrl( { mathUrl, peleUrl } ) {
	return (
		mathUrl ||
		new URL( '../math.js', new URL( peleUrl, document.baseURI ) ).href
	);
}
