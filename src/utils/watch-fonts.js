/**
 * Tells when web fonts finish loading, so diagrams that were measured in the
 * font before them can be drawn again.
 *
 * Text is measured in the font the browser has at that moment: a web font that
 * arrives after a diagram was drawn leaves labels measured for the fallback.
 */

/**
 * Calls `onLoaded` each time a batch of fonts finishes loading.
 *
 * @param {Function} onLoaded       Called without arguments.
 * @param {Document} [doc=document] The document whose fonts are watched.
 *
 * @return {Function} Stops watching. Where the browser can't tell (the
 * document has no `fonts`), nothing is watched and this does nothing.
 */
export default function watchFonts( onLoaded, doc = document ) {
	const fonts = doc.fonts;

	if ( ! fonts || typeof fonts.addEventListener !== 'function' ) {
		return () => {};
	}

	fonts.addEventListener( 'loadingdone', onLoaded );

	return () => fonts.removeEventListener( 'loadingdone', onLoaded );
}
