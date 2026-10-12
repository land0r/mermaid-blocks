<?php
/**
 * The plugin's global functions. Its classes are in the `MermaidBlocks`
 * namespace, and Composer's autoloader loads them.
 *
 * @package MermaidBlocks
 */

use MermaidBlocks\Plugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Returns the plugin, which gives access to its parts.
 *
 * @return Plugin The plugin.
 */
function mermaid_blocks(): Plugin {
	return Plugin::instance();
}
