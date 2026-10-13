/**
 * Mermaid configuration shared by the front end and the editor preview, so a
 * diagram renders the same way in both.
 *
 * @see https://mermaid.js.org/config/schema-docs/config.html
 */

/*
 * The diagram types Mermaid 12 lays out with ELK unless a diagram asks for
 * another layout, by the name of their options. ELK is 1.6 MB of JavaScript,
 * twice everything else a flowchart loads. So these types get dagre, the
 * layout they had before Mermaid 12, and only a diagram that asks for ELK
 * loads it. A unit test compares the list with the bundled Mermaid.
 */
export const DAGRE_TYPES = [
	'flowchart',
	'class',
	'state',
	'er',
	'requirement',
	'agentflow',
];

// The types left with ELK. Mermaid never drew a use case diagram with dagre
// before, and dagre draws the lines between use cases through other use cases.
export const ELK_TYPES = [ 'usecase' ];

const MERMAID_CONFIG = {
	// Blocks are rendered explicitly; never scan the page on load.
	startOnLoad: false,
};

// Per type, not `layout` for all of them: that one would also replace the
// layouts mind maps and swimlane diagrams have of their own.
DAGRE_TYPES.forEach( ( type ) => {
	MERMAID_CONFIG[ type ] = { layout: 'dagre' };
} );

/**
 * Adds options to a Mermaid configuration. The options of a diagram type are
 * added to those the type already has, where spreading would replace them.
 *
 * @param {Object} config  A Mermaid configuration.
 * @param {Object} options The options to add. They win over those of
 *                         `config`.
 *
 * @return {Object} A new configuration. Neither argument is changed.
 */
export function mergeConfig( config, options ) {
	const merged = { ...config };

	Object.keys( options ).forEach( ( key ) => {
		const isSection = ( value ) =>
			!! value && typeof value === 'object' && ! Array.isArray( value );

		merged[ key ] =
			isSection( config[ key ] ) && isSection( options[ key ] )
				? { ...config[ key ], ...options[ key ] }
				: options[ key ];
	} );

	return merged;
}

export default MERMAID_CONFIG;
