<?php
/**
 * Plugin Name:       GraphDraw – Mermaid Diagrams & Flowcharts
 * Plugin URI:        https://github.com/land0r/graphdraw
 * Description:       Draw Mermaid diagrams in the block editor, with a live preview: flowcharts, sequence, class and Gantt diagrams, mind maps and more.
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Version:           1.0.0
 * Author:            Ivan Hryhorenko
 * License:           GPL-3.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain:       graphdraw-mermaid-diagrams-flowcharts
 *
 * @package GraphDraw
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'GRAPHDRAW_PLUGIN_FILE', __FILE__ );

/**
 * Tells those who manage plugins why this one does nothing: it is a copy of
 * the source repository, which holds neither the autoloader nor the build.
 */
function graphdraw_show_build_notice() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	$message = sprintf(
		/* translators: 1: A command, 2: Another command. */
		__( 'GraphDraw is missing its build. Run %1$s and %2$s in its folder, or install a release of the plugin.', 'graphdraw-mermaid-diagrams-flowcharts' ),
		'<code>composer install</code>',
		'<code>npm ci &amp;&amp; npm run build</code>'
	);

	printf( '<div class="notice notice-error"><p>%s</p></div>', wp_kses( $message, array( 'code' => array() ) ) );
}

// Both are generated, and only releases include them.
if ( ! file_exists( __DIR__ . '/vendor/autoload.php' ) || ! file_exists( __DIR__ . '/build/block.json' ) ) {
	add_action( 'admin_notices', 'graphdraw_show_build_notice' );
	return;
}

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/includes/functions.php';

graphdraw()->init();
