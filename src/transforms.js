// Import createBlock to programmatically create a new block
import { createBlock } from '@wordpress/blocks';

// Import decodeEntities to decode HTML entities (e.g., &gt; → >)
import { decodeEntities } from '@wordpress/html-entities';

/**
 * Returns the text of a block: the HTML in its `content` attribute.
 *
 * The transform below is offered for every block type, and most of them have
 * no such attribute, or keep something other than text in it.
 *
 * @param {Object} attributes The attributes of the block.
 *
 * @return {string|null} The text, or null for a block that has none.
 */
const getContent = ( attributes ) => {
	const content = attributes?.content;

	if ( typeof content === 'string' ) {
		return content;
	}

	// A rich text attribute holds a RichTextData object, not a string.
	if ( typeof content?.toHTMLString === 'function' ) {
		return content.toHTMLString();
	}

	return null;
};

// The class that marks a Code block as Mermaid: see
// includes/Integrations/CodeBlocks.php.
const MERMAID_CLASS = 'language-mermaid';

/**
 * Tells whether a block has the class that marks code as Mermaid among its
 * additional CSS classes.
 *
 * @param {Object} attributes The attributes of the block.
 *
 * @return {boolean} Whether the block is marked as Mermaid.
 */
const isMarkedAsMermaid = ( attributes ) =>
	typeof attributes?.className === 'string' &&
	attributes.className.split( /\s+/ ).includes( MERMAID_CLASS );

/**
 * Returns the Mermaid source in the content of a Code block: its text, read
 * as CodeBlocks::get_code() reads it for visitors. Formatting is dropped and
 * its text kept, a line break element is a line break in a label, and
 * character references are decoded.
 *
 * @param {string} html The content of the block.
 *
 * @return {string} The source.
 */
const getCode = ( html ) =>
	decodeEntities(
		html
			.replace( /<br\s*\/?>/gi, '&lt;br/&gt;' )
			.replace( /<\/?[a-z][^>]*>/gi, '' )
	)
		.replace( /\u00a0/g, ' ' )
		.trim();

const transforms = {
	from: [
		{
			type: 'block',
			blocks: [ '*' ],
			isMultiBlock: true,
			/**
			 * Checks if the selected blocks match the pattern for a MermaidJS code block.
			 * Every block must hold text. The first block must start with "```mermaid",
			 * and the last block must end with "```".
			 *
			 * @param {Array} blocks The attributes of each selected block.
			 *
			 * @return {boolean} Whether the selected blocks match the MermaidJS syntax pattern.
			 */
			isMatch: ( blocks ) => {
				const contents = blocks.map( getContent );

				// A block without text can't be part of the code
				if ( ! contents.length || contents.includes( null ) ) {
					return false;
				}

				// Trim content for the first and last block
				const firstBlockContent = contents[ 0 ].trim();
				const lastBlockContent = contents[ contents.length - 1 ].trim();

				// Check if the first block starts with "```mermaid" and the last block ends with "```"
				return (
					firstBlockContent.startsWith( '```mermaid' ) &&
					lastBlockContent.endsWith( '```' )
				);
			},

			/**
			 * Transforms the selected paragraph blocks into a MermaidJS block.
			 * Combines the content of all selected blocks into a single MermaidJS code string.
			 *
			 * @param {Array} blocks - The attributes of each selected block.
			 *
			 * @return {Object} The new MermaidJS block.
			 */
			transform: ( blocks ) => {
				// Merge content of all blocks, excluding "```mermaid" and "```"
				const mergedContent = blocks
					.map( ( block ) => {
						const content = decodeEntities(
							( getContent( block ) || '' ).trim()
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

				return createBlock( 'graphdraw/diagram', {
					code: mergedContent.trim(),
				} );
			},
		},
		{
			type: 'block',
			blocks: [ 'core/code' ],

			/**
			 * Checks if a Code block is marked as Mermaid, with the class the
			 * site may show as a diagram already, and holds code.
			 *
			 * @param {Object} attributes The attributes of the block.
			 *
			 * @return {boolean} Whether the block can become a diagram block.
			 */
			isMatch: ( attributes ) =>
				isMarkedAsMermaid( attributes ) &&
				!! getCode( getContent( attributes ) || '' ),

			/**
			 * Transforms a Code block marked as Mermaid into a diagram block,
			 * which has settings of its own.
			 *
			 * @param {Object} attributes The attributes of the block.
			 *
			 * @return {Object} The new MermaidJS block.
			 */
			transform: ( attributes ) =>
				createBlock( 'graphdraw/diagram', {
					code: getCode( getContent( attributes ) || '' ),
				} ),
		},
	],
};

export default transforms;
