import {
	DARK,
	LIGHT,
	PALETTES,
	applyPalette,
	getPaletteName,
} from '../pele-palette';
import { AUTO_DARK, AUTO_LIGHT, THEMES, getCodeTheme } from '../themes';

/**
 * Returns the relative luminance of a `#rrggbb` colour, as WCAG defines it.
 *
 * @param {string} hex The colour.
 *
 * @return {number} From 0, black, to 1, white.
 */
function luminance( hex ) {
	const [ r, g, b ] = [ 1, 3, 5 ].map( ( index ) => {
		const value = parseInt( hex.slice( index, index + 2 ), 16 ) / 255;

		return value <= 0.03928
			? value / 12.92
			: ( ( value + 0.055 ) / 1.055 ) ** 2.4;
	} );

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = ( first, second ) => {
	const [ high, low ] = [ luminance( first ), luminance( second ) ].sort(
		( a, b ) => b - a
	);

	return ( high + 0.05 ) / ( low + 0.05 );
};

describe( 'getPaletteName', () => {
	it.each( [ 'dark', 'neo-dark', 'redux-dark', 'redux-dark-color' ] )(
		'draws the %s theme dark',
		( theme ) => {
			expect( getPaletteName( theme, 'flowchart LR\nA --> B' ) ).toBe(
				DARK
			);
		}
	);

	it.each( THEMES.filter( ( theme ) => ! theme.includes( 'dark' ) ) )(
		'draws the %s theme light',
		( theme ) => {
			expect( getPaletteName( theme, 'flowchart LR\nA --> B' ) ).toBe(
				LIGHT
			);
		}
	);

	it( 'draws a diagram that follows the page as the page is', () => {
		expect( getPaletteName( AUTO_LIGHT, 'graph' ) ).toBe( LIGHT );
		expect( getPaletteName( AUTO_DARK, 'graph' ) ).toBe( DARK );
	} );

	it( 'lets a theme in the front matter win', () => {
		const code = '---\nconfig:\n  theme: dark\n---\nflowchart LR\nA --> B';

		expect( getPaletteName( 'forest', code ) ).toBe( DARK );
		expect(
			getPaletteName(
				AUTO_DARK,
				'---\nconfig:\n  theme: forest\n---\ngraph'
			)
		).toBe( LIGHT );
	} );

	it( 'lets a theme in a directive win, over the front matter too', () => {
		expect(
			getPaletteName(
				'forest',
				'%%{init: {"theme": "dark"}}%%\nflowchart LR\nA --> B'
			)
		).toBe( DARK );
		expect(
			getPaletteName(
				'forest',
				"%%{init: {'theme':'neo-dark'}}%%\nflowchart LR"
			)
		).toBe( DARK );
		expect(
			getPaletteName(
				AUTO_DARK,
				'---\nconfig:\n  theme: dark\n---\n%%{init: {"theme": "forest"}}%%\ngraph'
			)
		).toBe( LIGHT );
	} );

	it( 'ignores the variables of a theme written in the code', () => {
		const code =
			'%%{init: {"themeVariables": {"darkMode": true, "primaryColor": "#000"}}}%%\ngraph';

		expect( getPaletteName( AUTO_LIGHT, code ) ).toBe( LIGHT );
		expect( getCodeTheme( code ) ).toBe( '' );
	} );
} );

describe( 'the palettes', () => {
	it( 'set the same variables, every one Pele reads', () => {
		expect( Object.keys( PALETTES[ DARK ] ) ).toEqual(
			Object.keys( PALETTES[ LIGHT ] )
		);
		expect( Object.keys( PALETTES[ LIGHT ] ) ).toEqual(
			expect.arrayContaining( [
				'--pele-bg',
				'--pele-fg',
				'--pele-muted',
				'--pele-line',
				'--pele-surface',
				'--pele-surface-alt',
				'--pele-border',
				'--pele-accent',
				'--pele-error',
				'--pele-critical',
				...[ 1, 2, 3, 4, 5, 6, 7, 8 ].map(
					( number ) => `--pele-series-${ number }`
				),
			] )
		);
	} );

	it( 'make the dark one readable on a dark surface', () => {
		const dark = PALETTES[ DARK ];

		[ 'bg', 'surface', 'surface-alt' ].forEach( ( surface ) => {
			[ 'fg', 'muted' ].forEach( ( text ) => {
				expect(
					contrast(
						dark[ `--pele-${ text }` ],
						dark[ `--pele-${ surface }` ]
					)
				).toBeGreaterThanOrEqual( 4.5 );
			} );
		} );

		[
			'line',
			'border',
			'accent',
			'error',
			'critical',
			...[ 1, 2, 3, 4, 5, 6, 7, 8 ].map(
				( number ) => `series-${ number }`
			),
		].forEach( ( name ) => {
			expect(
				contrast( dark[ `--pele-${ name }` ], dark[ '--pele-bg' ] )
			).toBeGreaterThanOrEqual( 3 );
		} );
	} );

	it( 'keep the light one as Pele draws without any', () => {
		// Pele's fallbacks, as in the SVG it draws.
		expect( PALETTES[ LIGHT ] ).toMatchObject( {
			'--pele-bg': '#ffffff',
			'--pele-fg': '#1f1f1f',
			'--pele-surface': '#f3f3f3',
			'--pele-border': '#8a8a8a',
			'--pele-series-1': '#4c78a8',
		} );
	} );
} );

describe( 'applyPalette', () => {
	const canvas = () => document.createElement( 'div' );

	it( 'puts the variables of the palette on the element', () => {
		const element = canvas();

		applyPalette( element, DARK, null );

		expect( element.style.getPropertyValue( '--pele-fg' ) ).toBe(
			PALETTES[ DARK ][ '--pele-fg' ]
		);
		expect( element.style.getPropertyValue( '--pele-bg' ) ).toBe(
			PALETTES[ DARK ][ '--pele-bg' ]
		);
		expect( element.dataset.mermaidPalette ).toBe( DARK );
	} );

	it( 'gives the label boxes the colour of the surface when it is known', () => {
		const element = canvas();

		applyPalette( element, DARK, {
			isDark: true,
			color: 'rgb(17, 24, 39)',
		} );

		expect( element.style.getPropertyValue( '--pele-bg' ) ).toBe(
			'rgb(17, 24, 39)'
		);
	} );

	it( "keeps the palette's own background where no surface can be read", () => {
		const element = canvas();

		applyPalette( element, LIGHT, { isDark: false, color: null } );

		expect( element.style.getPropertyValue( '--pele-bg' ) ).toBe(
			PALETTES[ LIGHT ][ '--pele-bg' ]
		);
	} );

	it( 'does not put a light surface behind the labels of a dark diagram', () => {
		const element = canvas();

		applyPalette( element, DARK, {
			isDark: false,
			color: 'rgb(250, 250, 250)',
		} );

		expect( element.style.getPropertyValue( '--pele-bg' ) ).toBe(
			PALETTES[ DARK ][ '--pele-bg' ]
		);
	} );

	it( 'swaps one palette for the other', () => {
		const element = canvas();

		applyPalette( element, DARK, null );
		applyPalette( element, LIGHT, null );

		expect( element.style.getPropertyValue( '--pele-fg' ) ).toBe(
			PALETTES[ LIGHT ][ '--pele-fg' ]
		);
		expect( element.dataset.mermaidPalette ).toBe( LIGHT );
	} );
} );
