import { renderDiagram } from '../utils/render-diagram';

const DIAGRAM_SELECTOR = '.mermaid-blocks-diagram';
const SOURCE_SELECTOR = '.mermaid-blocks-diagram__source';

let counter = 0;

/**
 * Finds the diagrams under `root`, and `root` itself when it is one.
 *
 * @param {Document|HTMLElement} root Where to look for diagrams.
 *
 * @return {HTMLElement[]} The diagram elements.
 */
export function findDiagrams( root ) {
	const diagrams = Array.from( root.querySelectorAll( DIAGRAM_SELECTOR ) );

	if ( root.matches && root.matches( DIAGRAM_SELECTOR ) ) {
		diagrams.unshift( root );
	}

	return diagrams;
}

/**
 * Renders every not-yet-processed diagram under `root`: the block's, and any
 * other integration's that outputs the same markup (see includes/diagram.php).
 *
 * @param {Object}               mermaid           The Mermaid library object.
 * @param {Document|HTMLElement} [root]            Where to look for diagrams.
 * @param {Document}             [mermaidDocument] The document of the window
 *                                                 Mermaid runs in.
 *
 * @return {Promise<void>} Resolves when all diagrams have been processed.
 */
export default async function renderDiagrams(
	mermaid,
	root = document,
	mermaidDocument = root.ownerDocument || root
) {
	const doc = root.ownerDocument || root;

	for ( const diagram of findDiagrams( root ) ) {
		const source = diagram.querySelector( SOURCE_SELECTOR );

		if (
			! source ||
			diagram.classList.contains( 'is-rendered' ) ||
			diagram.classList.contains( 'has-error' ) ||
			diagram.dataset.mermaidProcessing
		) {
			continue;
		}

		diagram.dataset.mermaidProcessing = '1';
		counter += 1;

		const result = await renderDiagram(
			mermaid,
			`mermaid-blocks-diagram-${ counter }`,
			source.textContent,
			mermaidDocument
		);

		if ( result.error ) {
			diagram.classList.add( 'has-error' );
			// eslint-disable-next-line no-console
			console.error(
				'Mermaid Blocks: failed to render diagram.',
				result.error.message
			);
		} else {
			const canvas = doc.createElement( 'div' );
			canvas.className = 'mermaid-blocks-diagram__canvas';
			canvas.innerHTML = result.svg;

			if ( typeof result.bindFunctions === 'function' ) {
				result.bindFunctions( canvas );
			}

			diagram.appendChild( canvas );
			source.hidden = true;
			diagram.classList.add( 'is-rendered' );
		}

		delete diagram.dataset.mermaidProcessing;
	}
}
