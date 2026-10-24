import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';

import {
	AUTO_DARK,
	AUTO_LIGHT,
	AUTO_THEME,
	THEMES,
	getCodeTheme,
	getThemeConfig,
	isDarkTheme,
	resolveTheme,
} from '../themes';
import { getSurface } from '../surface';

jest.mock( '../surface', () => ( { getSurface: jest.fn() } ) );

describe( 'resolveTheme', () => {
	const element = document.createElement( 'div' );

	beforeEach( () => {
		getSurface.mockReset();
		getSurface.mockReturnValue( { isDark: false, color: null } );
	} );

	it.each( THEMES )(
		'keeps the %s theme, whatever the surface',
		( theme ) => {
			getSurface.mockReturnValue( { isDark: true, color: null } );

			expect( resolveTheme( theme, element ) ).toBe( theme );
			expect( getSurface ).not.toHaveBeenCalled();
		}
	);

	it( 'follows the surface of the element for the automatic theme', () => {
		expect( resolveTheme( AUTO_THEME, element ) ).toBe( AUTO_LIGHT );

		getSurface.mockReturnValue( { isDark: true, color: null } );

		expect( resolveTheme( AUTO_THEME, element ) ).toBe( AUTO_DARK );
		expect( getSurface ).toHaveBeenCalledWith( element );
	} );

	it.each( [ [ undefined ], [ '' ], [ 'unknown' ], [ 'toString' ] ] )(
		'counts %p as the automatic theme',
		( theme ) => {
			expect( resolveTheme( theme, element ) ).toBe( AUTO_LIGHT );
		}
	);
} );

describe( 'isDarkTheme', () => {
	it.each( THEMES )( 'tells whether the %s theme is dark', ( theme ) => {
		expect( isDarkTheme( theme ) ).toBe( theme.includes( 'dark' ) );
	} );

	it( 'tells what a diagram that follows the page was drawn for', () => {
		expect( isDarkTheme( AUTO_DARK ) ).toBe( true );
		expect( isDarkTheme( AUTO_LIGHT ) ).toBe( false );
	} );

	it.each( [ [ undefined ], [ '' ], [ AUTO_THEME ], [ 'toString' ] ] )(
		'counts %p as light',
		( theme ) => {
			expect( isDarkTheme( theme ) ).toBe( false );
		}
	);
} );

describe( 'getThemeConfig', () => {
	// The shape of Mermaid's default configuration, with a few of its types.
	const mermaid = {
		mermaidAPI: {
			defaultConfig: {
				theme: 'default',
				look: 'classic',
				startOnLoad: true,
				themeVariables: null,
				flowchart: { theme: 'redux-color', look: 'neo', padding: 15 },
				sequence: { theme: 'redux-color' },
				pie: { textPosition: 0.75 },
				mindmap: { theme: 'neo' },
				journey: { theme: 'forest' },
			},
		},
	};

	it( 'leaves the theme to Mermaid on a light surface', () => {
		expect( getThemeConfig( mermaid, AUTO_LIGHT ) ).toEqual( {} );
	} );

	it.each( THEMES )( 'names the %s theme', ( theme ) => {
		expect( getThemeConfig( mermaid, theme ) ).toEqual( { theme } );
	} );

	it( 'names the dark counterpart of each theme Mermaid picks on a dark surface', () => {
		expect( getThemeConfig( mermaid, AUTO_DARK ) ).toEqual( {
			theme: 'dark',
			flowchart: { theme: 'redux-dark-color' },
			sequence: { theme: 'redux-dark-color' },
			mindmap: { theme: 'neo-dark' },
		} );
	} );

	it( 'names the dark theme when the defaults of Mermaid cannot be read', () => {
		expect( getThemeConfig( {}, AUTO_DARK ) ).toEqual( { theme: 'dark' } );
	} );
} );

/*
 * The list is written out in two places, and Mermaid has its own. These read
 * the other two, so a theme added to one of them, or by a Mermaid upgrade,
 * is not forgotten.
 */
describe( 'the themes', () => {
	const mermaidDir = dirname( require.resolve( 'mermaid/package.json' ) );

	it( 'are all the themes of the bundled Mermaid', () => {
		// The type of its `theme` option: 'default' | 'base' | … | 'null'.
		const types = readFileSync(
			join( mermaidDir, 'dist/config.type.d.ts' ),
			'utf8'
		);
		const [ , union ] = /^\s*theme\?: ('[^;]+);$/m.exec( types );
		const names = union
			.split( ' | ' )
			.map( ( name ) => name.replace( /'/g, '' ) )
			// Not a theme: it leaves a diagram without any colours.
			.filter( ( name ) => name !== 'null' );

		expect( [ ...THEMES ].sort() ).toEqual( names.sort() );
	} );

	it( 'are the themes that have a label, in the same order', () => {
		const php = readFileSync(
			join( __dirname, '../../../includes/Themes.php' ),
			'utf8'
		);
		const [ list ] = /function get_all\(\)[^{]*\{[\s\S]*?\n\t\}/.exec(
			php
		);
		const names = Array.from(
			list.matchAll( /'([\w-]+)'\s*=> __\(/g ),
			( [ , name ] ) => name
		);

		expect( names ).toEqual( [ AUTO_THEME, ...THEMES ] );
	} );

	it( 'have a dark counterpart for each theme Mermaid picks by itself', () => {
		// Mermaid's default configuration, in one of the files of its build.
		const chunksDir = join( mermaidDir, 'dist/chunks/mermaid.core' );
		const marker = 'var config_schema_default = {';
		let defaults;

		readdirSync( chunksDir )
			.filter( ( file ) => file.endsWith( '.mjs' ) )
			.some( ( file ) => {
				const code = readFileSync( join( chunksDir, file ), 'utf8' );
				const start = code.indexOf( marker );

				if ( start !== -1 ) {
					defaults = code.slice(
						start,
						code.indexOf( '\n};', start )
					);
				}

				return start !== -1;
			} );

		const picked = Array.from(
			new Set(
				Array.from(
					defaults.matchAll( /"theme": "([\w-]+)"/g ),
					( [ , name ] ) => name
				)
			)
		);

		expect( picked ).toContain( 'default' );
		expect( picked.length ).toBeGreaterThan( 1 );

		picked.forEach( ( theme ) => {
			const config = getThemeConfig(
				{ mermaidAPI: { defaultConfig: { flowchart: { theme } } } },
				AUTO_DARK
			);

			expect( { theme, counterpart: config.flowchart } ).toEqual( {
				theme,
				counterpart: { theme: expect.any( String ) },
			} );
			expect( THEMES ).toContain( config.flowchart.theme );
		} );
	} );
} );

describe( 'getCodeTheme', () => {
	it.each( [
		[
			'the front matter',
			'---\nconfig:\n  theme: forest\n---\ngraph',
			'forest',
		],
		[
			'a quoted front matter theme',
			'---\nconfig:\n  theme: "dark"\n---\ngraph',
			'dark',
		],
		[ 'a directive', '%%{init: {"theme": "neutral"}}%%\ngraph', 'neutral' ],
		[
			'a directive with single quotes',
			"%%{init: {'theme':'base'}}%%\ngraph",
			'base',
		],
		[
			'an initialize directive',
			'%%{initialize: {"theme": "dark"}}%%\ngraph',
			'dark',
		],
		[
			'a directive, over the front matter',
			'---\nconfig:\n  theme: forest\n---\n%%{init: {"theme": "dark"}}%%\ngraph',
			'dark',
		],
		[
			'the last directive',
			'%%{init: {"theme": "dark"}}%%\n%%{init: {"theme": "forest"}}%%\ngraph',
			'forest',
		],
		[ 'no theme', 'flowchart LR\nA --> B', '' ],
		[
			'a front matter title only',
			'---\ntitle: theme: dark\n---\ngraph',
			'',
		],
		[
			'theme variables only',
			'%%{init: {"themeVariables": {"primaryColor": "#fff"}}}%%\ngraph',
			'',
		],
	] )( 'finds the theme in %s', ( name, code, expected ) => {
		expect( getCodeTheme( code ) ).toBe( expected );
	} );
} );
