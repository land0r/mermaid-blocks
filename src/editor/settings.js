/**
 * What the server tells the editor about themes, printed before the editor
 * script by includes/Admin/Editor.php: the labels of the themes offered with
 * the site's renderer, by name and in the order they are offered; the theme
 * each one that isn't offered is shown as; the site's theme, which a diagram
 * without a theme of its own is drawn in; and the URL of the page that theme
 * is set on, for those who may change it. With Pele, also the options the
 * site gives it.
 */
import { AUTO_THEME, THEMES } from '../utils/themes';

const settings = window.graphDrawEditorSettings || {};

const hasOwn = ( object, key ) =>
	Object.prototype.hasOwnProperty.call( object, key );

export const THEME_LABELS =
	settings.themes ||
	Object.fromEntries(
		[ AUTO_THEME, ...THEMES ].map( ( name ) => [ name, name ] )
	);

// The themes that aren't offered, each with the offered theme it is drawn as: with Pele, Light or Dark.
export const THEME_ALIASES = settings.themeAliases || {};

export const SITE_THEME = settings.theme || AUTO_THEME;

export const SETTINGS_URL = settings.settingsUrl || '';

/**
 * Returns the theme a diagram has of its own.
 *
 * @param {string} [theme] The diagram's `theme` attribute.
 *
 * @return {string} The theme, offered or not, or an empty string for none. A
 * name that is no theme counts as none, as it does on the front end.
 */
export function getOwnTheme( theme ) {
	return theme === AUTO_THEME || THEMES.includes( theme ) ? theme : '';
}

/**
 * Returns the offered theme a picker shows a theme as. A diagram keeps a
 * theme that isn't offered until another is picked: it is drawn the same.
 *
 * @param {string} theme A theme, or an empty string for none.
 *
 * @return {string} The theme, or the offered one it is drawn as.
 */
export function getShownTheme( theme ) {
	return hasOwn( THEME_ALIASES, theme ) ? THEME_ALIASES[ theme ] : theme;
}

// Pele's render options for the site, which the renderer merges under its own.
export const PELE_OPTIONS = settings.peleOptions || undefined;

// Where the math module is, `build/math.js`, which draws the formulas of Pele diagrams.
export const MATH_URL = settings.mathUrl || '';

// The URL of the Iconify JSON of each icon pack the site registered, by name,
// for either renderer.
export const ICON_PACKS = settings.iconPacks || undefined;
