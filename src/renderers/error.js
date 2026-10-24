import { toSourceLine } from '../utils/source-line';

/**
 * Returns the message of what a library threw or rejected with.
 *
 * @param {*} error The value it threw.
 *
 * @return {string} The message.
 */
export function getMessage( error ) {
	return ( error && error.message ) || String( error );
}

/**
 * Returns an error as the renderers report it.
 *
 * @param {string}        code    The Mermaid source.
 * @param {string}        message The message.
 * @param {(number|null)} line    The 1-based line the library reported, which
 *                                counts the lines of the text it parsed, or
 *                                null or 0 when it reported none.
 *
 * @return {{error: {message: string, line: (number|null)}}} The message, and
 * the 1-based line of `code` it points at, front matter and directives
 * counted, or null.
 */
export function toError( code, message, line ) {
	return {
		error: {
			message,
			line:
				Number.isInteger( line ) && line > 0
					? toSourceLine( code, line )
					: null,
		},
	};
}
