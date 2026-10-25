/**
 * Draws the diagram of an Elementor Mermaid Diagram widget that Elementor
 * shows after the page loaded: a widget its editor renders again after each
 * change, or one in a popup. Registered as the `graphdraw-elementor`
 * script, which the widget declares, so it loads only where the widget is
 * (see includes/Integrations/Elementor/).
 *
 * The diagrams that are on the page when it loads are drawn by `view.js`.
 */

// What Elementor fires for each widget it shows: `DiagramWidget::NAME`, and its default skin.
export const READY_HOOK = 'frontend/element_ready/graphdraw-diagram.default';

/**
 * Draws the diagram of a widget Elementor shows. It is drawn when it scrolls
 * into view, and skipped if it already is.
 *
 * @param {Object} $scope The widget's element, as a jQuery object.
 */
export function renderWidget( $scope ) {
	const element = $scope && $scope[ 0 ];

	if ( element && window.graphDraw ) {
		window.graphDraw.render( element );
	}
}

/**
 * Asks Elementor to tell when it shows a widget. Its hooks exist once its
 * front end has started: in the editor's preview, after this script ran.
 *
 * @param {Window} view The window Elementor runs in.
 */
export default function watchWidgets( view ) {
	const listen = () =>
		view.elementorFrontend.hooks.addAction( READY_HOOK, renderWidget );

	if ( view.elementorFrontend && view.elementorFrontend.hooks ) {
		listen();
	} else if ( view.jQuery ) {
		// Elementor triggers it with jQuery, and since 3.x as a DOM event too, which jQuery also hears.
		view.jQuery( view ).one( 'elementor/frontend/init', listen );
	}
}

watchWidgets( window );
