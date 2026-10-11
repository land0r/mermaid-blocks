/**
 * WordPress dependencies
 */
import { useBlockProps } from '@wordpress/block-editor';

/**
 * Previous static version of the block, which saved the code inside a `<pre>`.
 * Keeping it lets posts saved with that markup validate and migrate silently.
 */
const v1 = {
	attributes: {
		code: {
			type: 'string',
		},
	},
	supports: {
		html: false,
	},
	save( { attributes } ) {
		const { code } = attributes;

		return <pre { ...useBlockProps.save() }>{ code }</pre>;
	},
};

export default [ v1 ];
