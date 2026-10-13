import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';

import MERMAID_CONFIG, { DAGRE_TYPES, mergeConfig } from '../mermaid-config';

describe( 'MERMAID_CONFIG', () => {
	it( 'never scans the page for diagrams', () => {
		expect( MERMAID_CONFIG.startOnLoad ).toBe( false );
	} );

	it.each( DAGRE_TYPES )( 'lays out the %s type with dagre', ( type ) => {
		expect( MERMAID_CONFIG[ type ] ).toEqual( { layout: 'dagre' } );
	} );

	it( 'names no layout for all types at once', () => {
		// Mind maps and swimlane diagrams would lose theirs.
		expect( MERMAID_CONFIG ).not.toHaveProperty( 'layout' );
		expect( MERMAID_CONFIG ).not.toHaveProperty( 'mindmap' );
		expect( MERMAID_CONFIG ).not.toHaveProperty( 'swimlane' );
	} );
} );

describe( 'mergeConfig', () => {
	it( 'adds options and lets them win', () => {
		expect(
			mergeConfig(
				{ startOnLoad: false, theme: 'default' },
				{ theme: 'forest', look: 'neo' }
			)
		).toEqual( { startOnLoad: false, theme: 'forest', look: 'neo' } );
	} );

	it( 'adds the options of a diagram type to those it has', () => {
		expect(
			mergeConfig(
				{ flowchart: { layout: 'dagre' }, state: { layout: 'dagre' } },
				{ flowchart: { theme: 'dark' }, pie: { theme: 'dark' } }
			)
		).toEqual( {
			flowchart: { layout: 'dagre', theme: 'dark' },
			state: { layout: 'dagre' },
			pie: { theme: 'dark' },
		} );
	} );

	it( 'lets an option of a diagram type win', () => {
		expect(
			mergeConfig(
				{ flowchart: { layout: 'dagre', curve: 'basis' } },
				{ flowchart: { layout: 'elk' } }
			)
		).toEqual( { flowchart: { layout: 'elk', curve: 'basis' } } );
	} );

	it.each( [
		[ 'a list', [ 'a' ], [ 'b' ] ],
		[ 'a value in place of options', { layout: 'dagre' }, null ],
		[ 'options in place of a value', 'dagre', { layout: 'elk' } ],
	] )( 'replaces %s', ( name, before, after ) => {
		expect( mergeConfig( { key: before }, { key: after } ) ).toEqual( {
			key: after,
		} );
	} );

	it( 'changes neither argument', () => {
		const config = { flowchart: { layout: 'dagre' } };
		const options = { flowchart: { theme: 'dark' }, theme: 'dark' };

		mergeConfig( config, options );

		expect( config ).toEqual( { flowchart: { layout: 'dagre' } } );
		expect( options ).toEqual( {
			flowchart: { theme: 'dark' },
			theme: 'dark',
		} );
	} );

	it( 'leaves the shared configuration as it is', () => {
		const merged = mergeConfig( MERMAID_CONFIG, {
			flowchart: { layout: 'elk' },
		} );

		expect( merged.flowchart ).toEqual( { layout: 'elk' } );
		expect( MERMAID_CONFIG.flowchart ).toEqual( { layout: 'dagre' } );
	} );
} );

/*
 * The list is written out here, and Mermaid decides which types it is about.
 * This reads the build of the bundled Mermaid, so a type that an upgrade
 * starts to lay out with ELK, and with it 1.6 MB of JavaScript, is not missed.
 */
describe( 'the types laid out with dagre', () => {
	const chunksDir = join(
		dirname( require.resolve( 'mermaid/package.json' ) ),
		'dist/chunks/mermaid.core'
	);
	const chunks = readdirSync( chunksDir )
		.filter( ( file ) => file.endsWith( '.mjs' ) )
		.map( ( file ) => readFileSync( join( chunksDir, file ), 'utf8' ) );

	// Mermaid's default configuration: the options of each type are indented
	// once, and its own options twice.
	const marker = 'var config_schema_default = {';
	const defaults = chunks
		.filter( ( code ) => code.includes( marker ) )
		.map( ( code ) => {
			const start = code.indexOf( marker );

			return code.slice( start, code.indexOf( '\n};', start ) );
		} )
		.join( '' );

	/**
	 * Returns the layout Mermaid gives a diagram type that asks for none.
	 *
	 * @param {string} type The name of the type's options.
	 *
	 * @return {string|undefined} The layout of the type's options, or else
	 * the one of all types.
	 */
	function getDefaultLayout( type ) {
		const [ , options = '' ] =
			new RegExp(
				`^ {2}"${ type }": \\{\\n([\\s\\S]*?)^ {2}\\}`,
				'm'
			).exec( defaults ) || [];
		const [ , layout ] =
			/^ {4}"layout": "([^"]+)"/m.exec( options ) ||
			/^ {2}"layout": "([^"]+)"/m.exec( defaults ) ||
			[];

		return layout;
	}

	// The types whose renderer takes its layout from the configuration, by the
	// directory of their source, which is the name of their options.
	const configurable = new Set();

	chunks.forEach( ( code ) => {
		const call = 'getRegisteredLayoutAlgorithm(layout)';

		for (
			let at = code.indexOf( call );
			at !== -1;
			at = code.indexOf( call, at + 1 )
		) {
			const sources = Array.from(
				code.slice( 0, at ).matchAll( /^\/\/ src\/diagrams\/(\w+)\//gm )
			);

			configurable.add( sources[ sources.length - 1 ][ 1 ] );
		}
	} );

	it( 'reads the defaults of the bundled Mermaid', () => {
		expect( getDefaultLayout( 'no-such-type' ) ).toBe( 'elk' );
		expect( getDefaultLayout( 'swimlane' ) ).toBe( 'swimlane' );
		expect( configurable.size ).toBeGreaterThan( 0 );
	} );

	it( 'are the types the bundled Mermaid lays out with ELK', () => {
		const types = Array.from( configurable ).filter(
			( type ) => getDefaultLayout( type ) === 'elk'
		);

		expect( [ ...DAGRE_TYPES ].sort() ).toEqual( types.sort() );
	} );
} );
