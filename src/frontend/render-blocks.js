const BLOCK_SELECTOR = '.wp-block-mermaid-blocks-diagram';
const SOURCE_SELECTOR = '.mermaid-blocks-diagram__source';

let counter = 0;

/**
 * Renders every not-yet-processed Mermaid block under `root`.
 *
 * @param {Object}               mermaid The Mermaid library object.
 * @param {Document|HTMLElement} root    Where to look for blocks.
 *
 * @return {Promise<void>} Resolves when all blocks have been processed.
 */
export default async function renderBlocks( mermaid, root = document ) {
	const blocks = Array.from( root.querySelectorAll( BLOCK_SELECTOR ) );

	for ( const block of blocks ) {
		const source = block.querySelector( SOURCE_SELECTOR );

		if (
			! source ||
			block.classList.contains( 'is-rendered' ) ||
			block.classList.contains( 'has-error' ) ||
			block.dataset.mermaidProcessing
		) {
			continue;
		}

		block.dataset.mermaidProcessing = '1';
		counter += 1;
		const id = `mermaid-blocks-diagram-${ counter }`;

		try {
			const result = await mermaid.render( id, source.textContent );
			const canvas = document.createElement( 'div' );
			canvas.className = 'mermaid-blocks-diagram__canvas';
			canvas.innerHTML = result.svg;

			if ( typeof result.bindFunctions === 'function' ) {
				result.bindFunctions( canvas );
			}

			block.appendChild( canvas );
			source.hidden = true;
			block.classList.add( 'is-rendered' );
		} catch ( error ) {
			block.classList.add( 'has-error' );
			// eslint-disable-next-line no-console
			console.error( 'Mermaid Blocks: failed to render diagram.', error );

			// A failed render leaves an orphan element in the body.
			const orphan = document.getElementById( 'd' + id );
			if ( orphan ) {
				orphan.remove();
			}
		} finally {
			delete block.dataset.mermaidProcessing;
		}
	}
}
