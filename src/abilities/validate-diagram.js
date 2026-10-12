/**
 * Internal dependencies
 */
import { getMermaid } from '../utils/mermaid-init';
import { parseDiagram } from '../utils/render-diagram';

/**
 * The name of the ability.
 */
export const NAME = 'mermaid-blocks/validate-diagram';

/**
 * The JSON Schema of the ability's input.
 */
export const INPUT_SCHEMA = {
	type: 'object',
	properties: {
		code: {
			type: 'string',
			minLength: 1,
			description: 'The Mermaid source to validate.',
		},
	},
	required: [ 'code' ],
	additionalProperties: false,
};

/**
 * The JSON Schema of the ability's output.
 */
export const OUTPUT_SCHEMA = {
	type: 'object',
	properties: {
		valid: {
			type: 'boolean',
			description: 'Whether Mermaid can parse the source.',
		},
		type: {
			type: 'string',
			description:
				'The type of diagram Mermaid detected, such as flowchart-v2 or sequence. Only for valid source.',
		},
		error: {
			type: 'object',
			description:
				'Why the source is not valid: the message, and the line of the source it is on, counting from 1, when known.',
			properties: {
				message: { type: 'string' },
				line: { type: 'integer' },
			},
		},
	},
	required: [ 'valid' ],
};

/**
 * Validates Mermaid source with the copy of Mermaid the editor loaded.
 *
 * @param {Object} input      The input.
 * @param {string} input.code The Mermaid source.
 *
 * @return {Promise<Object>} The output: see OUTPUT_SCHEMA.
 */
export async function validateDiagram( { code } ) {
	const instance = getMermaid( window );

	if ( ! instance ) {
		throw new Error( 'Mermaid is not loaded on this page.' );
	}

	const result = await parseDiagram( instance.mermaid, code );

	if ( ! result.error ) {
		return { valid: true, type: result.type };
	}

	const { message, line } = result.error;

	return {
		valid: false,
		error: line === null ? { message } : { message, line },
	};
}
