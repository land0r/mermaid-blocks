/**
 * React hook that is used to mark the block wrapper element.
 * It provides all the necessary props like the class name.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
 */
import { useBlockProps } from '@wordpress/block-editor';

/**
 * The save function defines the way in which the different attributes should
 * be combined into the final markup, which is then serialized by the block
 * editor into `post_content`.
 *
 * The serialized content includes the MermaidJS code in a `data-mermaid`
 * attribute, which will be processed on the front end to render the diagram.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#save
 *
 * @param {Object} props            The block props.
 * @param {Object} props.attributes The block attributes.
 *
 * @return {Element} The rendered block markup to be saved in the post content.
 */
export default function save( { attributes } ) {
	const { code } = attributes;

	return (
		<div
			{ ...useBlockProps.save( {
				'data-mermaid': code,
			} ) }
		/>
	);
}
