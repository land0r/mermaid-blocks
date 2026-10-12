<?php
/**
 * Plugin Name:       Mermaid Blocks
 * Description:       Mermaid Blocks: A Gutenberg block plugin that allows you to create, edit, and render diagrams using MermaidJS directly in the WordPress editor. Perfect for flowcharts, sequence diagrams, Gantt charts, and more.
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Version:           1.1.0
 * Author:            Ivan Hryhorenko
 * License:           GPL-3.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain:       mermaid-blocks
 *
 * @package MermaidBlocks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'MERMAID_BLOCKS_PLUGIN_FILE', __FILE__ );

require_once __DIR__ . '/includes/diagram.php';
require_once __DIR__ . '/includes/settings.php';

/**
 * Registers the block using the metadata loaded from the `block.json` file.
 * Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://developer.wordpress.org/reference/functions/register_block_type/
 */
function create_block_mermaid_blocks_block_init() {
	register_block_type( __DIR__ . '/build' );
}
add_action( 'init', 'create_block_mermaid_blocks_block_init' );

/**
 * Enqueues Mermaid in the editor canvas. The `mermaid-js` handle is
 * registered in includes/diagram.php.
 */
function enqueue_mermaid_blocks_assets() {
	/*
	 * Load Mermaid inside the editor canvas iframe, so previews are measured
	 * and rendered in the document they are shown in, as on the front end.
	 * WordPress collects the iframe's assets by firing `enqueue_block_assets`
	 * with block editor scripts switched off, which is the only admin context
	 * where this condition holds. The admin window keeps its own copy through
	 * the editor script's dependency, for editors that are not iframed.
	 */
	if ( is_admin() && ! wp_should_load_block_editor_scripts_and_styles() ) {
		wp_enqueue_script( 'mermaid-js' );
	}
}
add_action( 'enqueue_block_assets', 'enqueue_mermaid_blocks_assets' );

/**
 * Tells the editor the themes a diagram can have, the site's theme, which the
 * preview of a block without a theme of its own is drawn in, and, to those
 * who may change that one, where.
 */
function mermaid_blocks_add_editor_settings() {
	$block_type = WP_Block_Type_Registry::get_instance()->get_registered( 'mermaid-blocks/diagram' );

	if ( ! $block_type ) {
		return;
	}

	$settings = array(
		'themes'      => mermaid_blocks_get_themes(),
		'theme'       => mermaid_blocks_get_diagram_theme(),
		'settingsUrl' => current_user_can( 'manage_options' ) ? mermaid_blocks_get_settings_url() : '',
	);

	// The block's own editor script: `mermaid-js` is the library.
	foreach ( array_diff( $block_type->editor_script_handles, array( 'mermaid-js' ) ) as $handle ) {
		wp_add_inline_script(
			$handle,
			'var mermaidBlocksEditorSettings = ' . wp_json_encode( $settings ) . ';',
			'before'
		);
	}
}
add_action( 'enqueue_block_editor_assets', 'mermaid_blocks_add_editor_settings' );
