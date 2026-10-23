/**
 * The colours of a Pele diagram.
 *
 * Pele's SVG has no colours of its own: it draws with `--pele-*` CSS
 * variables, with a light fallback for each. A palette is a set of values for
 * them, put on the element that holds the SVG, so a diagram changes colours
 * without being drawn again. Pele has no named themes: a theme counts as dark
 * or as light (see getPaletteName()).
 */
import { getCodeTheme, isDarkTheme } from './themes';

export const LIGHT = 'light';
export const DARK = 'dark';

/*
 * Light is what Pele draws with when nothing sets a variable. Dark is a
 * matching neutral set: text, lines and series colours that stay readable on a
 * dark surface (a unit test checks their contrast).
 */
export const PALETTES = {
	[ LIGHT ]: {
		'--pele-bg': '#ffffff',
		'--pele-fg': '#1f1f1f',
		'--pele-muted': '#6e6e6e',
		'--pele-line': '#1f1f1f',
		'--pele-surface': '#f3f3f3',
		'--pele-surface-alt': '#e6e6e6',
		'--pele-border': '#8a8a8a',
		'--pele-accent': '#5b7bd5',
		'--pele-error': '#e45756',
		'--pele-critical': '#e45756',
		'--pele-series-1': '#4c78a8',
		'--pele-series-2': '#f58518',
		'--pele-series-3': '#54a24b',
		'--pele-series-4': '#e45756',
		'--pele-series-5': '#72b7b2',
		'--pele-series-6': '#eeca3b',
		'--pele-series-7': '#b279a2',
		'--pele-series-8': '#9d755d',
	},
	[ DARK ]: {
		'--pele-bg': '#1e1e1e',
		'--pele-fg': '#e6e6e6',
		'--pele-muted': '#a3a3a3',
		'--pele-line': '#c8c8c8',
		'--pele-surface': '#2b2b2b',
		'--pele-surface-alt': '#383838',
		'--pele-border': '#7a7a7a',
		'--pele-accent': '#8ba5f2',
		'--pele-error': '#ff7b79',
		'--pele-critical': '#ff7b79',
		'--pele-series-1': '#6f9fd1',
		'--pele-series-2': '#f79b45',
		'--pele-series-3': '#6bbd62',
		'--pele-series-4': '#f2706e',
		'--pele-series-5': '#7cc4bf',
		'--pele-series-6': '#e9c93f',
		'--pele-series-7': '#c18bb4',
		'--pele-series-8': '#b88f76',
	},
};

/**
 * Returns the palette a diagram is drawn in.
 *
 * A theme written in the code, in front matter or in a directive, wins over
 * the one the diagram was given, as with Mermaid.js. The dark themes, and a
 * diagram that follows a dark page, are dark; every other theme is light.
 *
 * @param {string} theme What the diagram is drawn in, as resolveTheme()
 *                       returns it.
 * @param {string} code  The Mermaid source.
 *
 * @return {string} LIGHT or DARK.
 */
export function getPaletteName( theme, code ) {
	return isDarkTheme( getCodeTheme( code ) || theme ) ? DARK : LIGHT;
}

/**
 * Puts a palette on the element that holds a Pele SVG.
 *
 * `--pele-bg` fills the boxes behind edge labels and the gaps between pie
 * slices, so it takes the colour of the surface under the diagram when that
 * can be read and is as dark or as light as the palette: a dark diagram on a
 * light page keeps its own background.
 *
 * @param {HTMLElement}                             element The canvas.
 * @param {string}                                  name    LIGHT or DARK.
 * @param {{isDark: boolean, color: (string|null)}} surface What the diagram
 *                                                          sits on: see
 *                                                          getSurface().
 */
export function applyPalette( element, name, surface ) {
	Object.entries( PALETTES[ name ] ).forEach( ( [ property, value ] ) =>
		element.style.setProperty( property, value )
	);

	if ( surface && surface.color && surface.isDark === ( name === DARK ) ) {
		element.style.setProperty( '--pele-bg', surface.color );
	}

	element.dataset.mermaidPalette = name;
}
