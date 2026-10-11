<?php
/**
 * Plugin Name:       Mermaid Blocks
 * Description:       Mermaid Blocks: A Gutenberg block plugin that allows you to create, edit, and render diagrams using MermaidJS directly in the WordPress editor. Perfect for flowcharts, sequence diagrams, Gantt charts, and more.
 * Requires at least: 6.6
 * Requires PHP:      7.2
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
 * Register block assets.
 */
function enqueue_mermaid_blocks_assets() {
	$mermaid_js_path = plugin_dir_url( __FILE__ ) . 'build/mermaid.min.js';
	$asset_file      = plugin_dir_path( __FILE__ ) . 'build/mermaid.asset.php';
	$asset           = file_exists( $asset_file ) ? include $asset_file : array();
	$mermaid_version = isset( $asset['version'] ) ? $asset['version'] : false;

	wp_register_script(
		'mermaid-js',
		$mermaid_js_path,
		array(),
		$mermaid_version,
		true
	);
}
add_action( 'enqueue_block_assets', 'enqueue_mermaid_blocks_assets' );
add_action( 'enqueue_block_editor_assets', 'enqueue_mermaid_blocks_assets' );
