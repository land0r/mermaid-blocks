/**
 * The themes a diagram can be drawn in.
 */
import { getSurface } from './surface';

// The themes of the bundled Mermaid, all of them. A unit test compares the
// list with Mermaid's own, and with Themes::get_all() in
// includes/Themes.php, which has their labels.
export const THEMES = [
	'default',
	'neutral',
	'dark',
	'forest',
	'base',
	'neo',
	'neo-dark',
	'redux',
	'redux-dark',
	'redux-color',
	'redux-dark-color',
];

// Follows the page: resolveTheme() turns it into one of the two below.
export const AUTO_THEME = 'auto';

/*
 * What a diagram that follows the page is drawn in. Mermaid picks a theme for
 * each diagram type when it is given none: that is AUTO_LIGHT, and how every
 * diagram looked before it could have a theme. AUTO_DARK is the dark
 * counterpart of whichever theme Mermaid picks.
 */
export const AUTO_LIGHT = 'auto-light';
export const AUTO_DARK = 'auto-dark';

// The dark counterparts of the themes Mermaid picks by itself.
const DARK_COUNTERPARTS = {
	default: 'dark',
	neo: 'neo-dark',
	redux: 'redux-dark',
	'redux-color': 'redux-dark-color',
};

/**
 * Tells whether a diagram drawn in a theme has light text, for a dark
 * surface.
 *
 * @param {string} theme What a diagram is drawn in, as resolveTheme() returns
 *                       it.
 *
 * @return {boolean} True for AUTO_DARK and for the dark themes.
 */
export function isDarkTheme( theme ) {
	return (
		theme === AUTO_DARK ||
		Object.values( DARK_COUNTERPARTS ).includes( theme )
	);
}

/**
 * Returns what to draw a diagram in.
 *
 * @param {string}  theme   The theme asked for: one of THEMES, or AUTO_THEME.
 *                          Anything else counts as AUTO_THEME.
 * @param {Element} element The diagram, or the element it will be shown in.
 *
 * @return {string} One of THEMES, or, for a diagram that follows the page,
 * AUTO_DARK on a dark surface and AUTO_LIGHT anywhere else.
 */
export function resolveTheme( theme, element ) {
	if ( THEMES.includes( theme ) ) {
		return theme;
	}

	return getSurface( element ).isDark ? AUTO_DARK : AUTO_LIGHT;
}

/**
 * Returns the part of Mermaid's configuration that draws diagrams in a theme.
 *
 * @param {Object} mermaid The Mermaid API object.
 * @param {string} theme   What resolveTheme() returned.
 *
 * @return {Object} Options for `mermaid.initialize()`. For AUTO_DARK they
 * name a theme for each diagram type Mermaid has a theme of its own for, read
 * from its default configuration, and the dark theme for all other types.
 */
export function getThemeConfig( mermaid, theme ) {
	if ( theme === AUTO_LIGHT ) {
		return {};
	}

	if ( theme !== AUTO_DARK ) {
		return { theme };
	}

	const defaults =
		( mermaid.mermaidAPI && mermaid.mermaidAPI.defaultConfig ) || {};
	const config = { theme: DARK_COUNTERPARTS.default };

	Object.keys( defaults ).forEach( ( key ) => {
		const counterpart =
			defaults[ key ] && DARK_COUNTERPARTS[ defaults[ key ].theme ];

		if ( counterpart ) {
			config[ key ] = { theme: counterpart };
		}
	} );

	return config;
}

const FRONT_MATTER = /^[ \t]*---[ \t]*\n([\s\S]*?)\n[ \t]*---[ \t]*(?:\n|$)/;
const DIRECTIVE = /%{2}{\s*init(?:ialize)?\s*:([\s\S]*?)}%{2}/gi;
const THEME_IN_DIRECTIVE = /["']?\btheme["']?\s*:\s*["']?([\w-]+)["']?/i;
const THEME_IN_CONFIG = /^[ \t]+theme:[ \t]*["']?([\w-]+)["']?[ \t]*$/m;

/**
 * Returns the theme a diagram's code asks for, in its front matter
 * (`config.theme`) or in an `%%{init}%%` directive. A directive wins over the
 * front matter, and a later one over an earlier one, as in Mermaid.
 *
 * @param {string} code The Mermaid source.
 *
 * @return {string} The name of the theme as it is written, or an empty string
 * when the code names none.
 */
export function getCodeTheme( code ) {
	const text = String( code ).replace( /\r\n?/g, '\n' );
	const frontMatter = FRONT_MATTER.exec( text );
	let theme = '';

	if ( frontMatter && /^config:/m.test( frontMatter[ 1 ] ) ) {
		const match = THEME_IN_CONFIG.exec(
			frontMatter[ 1 ].slice( frontMatter[ 1 ].search( /^config:/m ) )
		);
		theme = match ? match[ 1 ] : '';
	}

	for ( const directive of text.matchAll( DIRECTIVE ) ) {
		const match = THEME_IN_DIRECTIVE.exec( directive[ 1 ] );
		theme = match ? match[ 1 ] : theme;
	}

	return theme;
}
