/**
 * What the server tells the editor about themes, printed before the editor
 * script by includes/Admin/Editor.php: the labels of the themes, by name and
 * in the order they are offered; what a theme is with the site's renderer;
 * the site's theme, which a diagram without a theme of its own is drawn in;
 * and the URL of the page that theme is set on, for those who may change it.
 */
import { AUTO_THEME, THEMES } from '../utils/themes';

const settings = window.mermaidBlocksEditorSettings || {};

export const THEME_LABELS =
	settings.themes ||
	Object.fromEntries(
		[ AUTO_THEME, ...THEMES ].map( ( name ) => [ name, name ] )
	);

export const SITE_THEME = settings.theme || AUTO_THEME;

// What a theme is with the site's renderer: a sentence with Pele, nothing with Mermaid.js.
export const RENDERER_HELP = settings.rendererHelp || '';

export const SETTINGS_URL = settings.settingsUrl || '';

/**
 * Returns the theme a diagram has of its own.
 *
 * @param {string} [theme] The diagram's `theme` attribute.
 *
 * @return {string} The theme, or an empty string for none. A theme that isn't
 * offered counts as none, as it does on the front end.
 */
export function getOwnTheme( theme ) {
	return typeof theme === 'string' &&
		Object.prototype.hasOwnProperty.call( THEME_LABELS, theme )
		? theme
		: '';
}
