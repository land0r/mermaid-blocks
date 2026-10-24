import { AUTO_THEME, THEMES } from '../../utils/themes';

/**
 * Loads the editor's settings as the server printed them.
 *
 * @param {Object} [printed] What the server printed, or nothing.
 *
 * @return {Object} The module.
 */
function loadSettings( printed ) {
	let settings;

	window.mermaidBlocksEditorSettings = printed;
	jest.isolateModules( () => {
		settings = require( '../settings' );
	} );
	delete window.mermaidBlocksEditorSettings;

	return settings;
}

// What the server prints with Pele: the themes it offers, and the others.
const PELE = {
	themes: { auto: 'Automatic', default: 'Light', dark: 'Dark' },
	themeAliases: { forest: 'default', neutral: 'default', 'neo-dark': 'dark' },
	theme: 'forest',
};

describe( 'the editor settings', () => {
	it( 'offers every theme by its name when the server printed nothing', () => {
		const { THEME_LABELS, THEME_ALIASES, SITE_THEME } = loadSettings();

		expect( Object.keys( THEME_LABELS ) ).toEqual( [
			AUTO_THEME,
			...THEMES,
		] );
		expect( THEME_ALIASES ).toEqual( {} );
		expect( SITE_THEME ).toBe( AUTO_THEME );
	} );

	it( 'offers the themes the server offers', () => {
		const { THEME_LABELS, SITE_THEME } = loadSettings( PELE );

		expect( THEME_LABELS ).toEqual( PELE.themes );
		expect( SITE_THEME ).toBe( 'forest' );
	} );
} );

describe( 'getOwnTheme', () => {
	it( 'keeps a theme the renderer does not offer: it is drawn', () => {
		const { getOwnTheme } = loadSettings( PELE );

		expect( getOwnTheme( 'forest' ) ).toBe( 'forest' );
		expect( getOwnTheme( 'dark' ) ).toBe( 'dark' );
		expect( getOwnTheme( AUTO_THEME ) ).toBe( AUTO_THEME );
	} );

	it.each( [ [ undefined ], [ '' ], [ 'unknown' ], [ 'toString' ] ] )(
		'counts %p as none',
		( theme ) => {
			const { getOwnTheme } = loadSettings( PELE );

			expect( getOwnTheme( theme ) ).toBe( '' );
		}
	);
} );

describe( 'getShownTheme', () => {
	it( 'shows a theme that is not offered as the one it is drawn as', () => {
		const { getShownTheme } = loadSettings( PELE );

		expect( getShownTheme( 'forest' ) ).toBe( 'default' );
		expect( getShownTheme( 'neo-dark' ) ).toBe( 'dark' );
	} );

	it.each( [
		[ 'default' ],
		[ 'dark' ],
		[ AUTO_THEME ],
		[ '' ],
		[ 'toString' ],
	] )( 'shows %p as it is', ( theme ) => {
		const { getShownTheme } = loadSettings( PELE );

		expect( getShownTheme( theme ) ).toBe( theme );
	} );

	it( 'shows every theme as it is when all are offered', () => {
		const { getShownTheme } = loadSettings( { themeAliases: {} } );

		THEMES.forEach( ( theme ) =>
			expect( getShownTheme( theme ) ).toBe( theme )
		);
	} );
} );
