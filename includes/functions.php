<?php
/**
 * The plugin's global functions. Its classes are in the `GraphDraw`
 * namespace, and Composer's autoloader loads them.
 *
 * @package GraphDraw
 */

use GraphDraw\Plugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Returns the plugin, which gives access to its parts.
 *
 * @return Plugin The plugin.
 */
function graphdraw(): Plugin {
	return Plugin::instance();
}
