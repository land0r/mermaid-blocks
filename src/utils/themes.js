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
