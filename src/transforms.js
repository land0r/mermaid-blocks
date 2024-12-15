// Import createBlock to programmatically create a new block
import { createBlock } from '@wordpress/blocks';

// Import decodeEntities to decode HTML entities (e.g., &gt; → >)
import { decodeEntities } from '@wordpress/html-entities';

const transforms = {
	from: [
		{
			type: 'block',
			blocks: [ '*' ],
			isMultiBlock: true,
			/**
			 * Checks if the selected blocks match the pattern for a MermaidJS code block.
			 * The first block must start with "```mermaid", and the last block must end with "```".
			 *
			 * @param {Array} blocks The array of selected blocks to check.
			 *
			 * @return {boolean} Whether the selected blocks match the MermaidJS syntax pattern.
			 */
			isMatch: ( blocks ) => {
				if ( ! blocks.length ) {
					return false;
				}

				// Trim content for the first and last block
				const firstBlockContent = blocks[ 0 ]?.content.trim();
				const lastBlockContent =
					blocks[ blocks.length - 1 ]?.content.trim();

				// Check if the first block starts with "```mermaid" and the last block ends with "```"
				return (
					firstBlockContent?.startsWith( '```mermaid' ) &&
					lastBlockContent?.endsWith( '```' )
				);
			},

			/**
			 * Transforms the selected paragraph blocks into a MermaidJS block.
			 * Combines the content of all selected blocks into a single MermaidJS code string.
			 *
			 * @param {Array} blocks - The array of selected blocks to transform.
			 *
			 * @return {Object} The new MermaidJS block.
			 */
			transform: ( blocks ) => {
				// Merge content of all blocks, excluding "```mermaid" and "```"
				const mergedContent = blocks
					.map( ( block ) => {
						const content = decodeEntities(
							block?.content.trim() || ''
						);

						if ( content.startsWith( 'title:' ) ) {
							return `---\n${ content }\n---`;
						}

						return content;
					} )
					.join( '\n' )
					.replace( /<br\s*\/?>/gi, '\n' ) // Replace <br> tags with newline
					.replace( /```mermaid/, '' ) // Remove the starting "```mermaid"
					.replace( /```$/, '' ); // Remove the ending "```"

				return createBlock( 'mermaid-blocks/diagram', {
					code: mergedContent.trim(),
				} );
			},
		},
	],
};

export default transforms;
