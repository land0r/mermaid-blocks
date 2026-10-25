/**
 * Shows the theme of an Elementor Mermaid Diagram widget that the site's
 * renderer doesn't offer, such as Forest with Pele, as the offered theme it is
 * drawn as: Elementor's select would show nothing for it. The widget keeps
 * its theme until another is picked.
 *
 * Loaded in Elementor's editor, and only when some theme isn't offered, with
 * those themes in `graphDrawThemeAliases` (see
 * includes/Integrations/Elementor/Registrar.php).
 */

// `DiagramWidget::NAME`, and the section of its theme.
export const WIDGET = 'graphdraw-diagram';
export const SECTION = 'section_settings';

/**
 * Shows the widget's theme in its select as the theme it is drawn as, when
 * the site's renderer doesn't offer it.
 *
 * @param {string} section The section Elementor opened.
 * @param {Object} panel   The panel that shows the element's controls.
 * @param {Object} aliases The themes that aren't offered, each with the
 *                         offered theme it is drawn as.
 */
export function showTheme( section, panel, aliases ) {
	const model = panel && panel.model;

	if (
		section !== SECTION ||
		! model ||
		model.get( 'widgetType' ) !== WIDGET
	) {
		return;
	}

	const theme = model.get( 'settings' ).get( 'theme' );

	if ( Object.prototype.hasOwnProperty.call( aliases, theme ) ) {
		panel.$el.find( '[data-setting="theme"]' ).val( aliases[ theme ] );
	}
}

/**
 * Asks Elementor's editor to tell when it opens a section of an element's
 * controls: it renders them then.
 *
 * @param {Object} elementor Elementor's editor.
 * @param {Object} aliases   The themes that aren't offered, each with the
 *                           offered theme it is drawn as.
 */
export default function watchPanel( elementor, aliases ) {
	elementor.channels.editor.on( 'section:activated', ( section, panel ) =>
		showTheme( section, panel, aliases )
	);
}

if ( window.elementor && window.graphDrawThemeAliases ) {
	watchPanel( window.elementor, window.graphDrawThemeAliases );
}
