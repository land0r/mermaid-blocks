<?php
/**
 * Plugin Name:       Mermaid Blocks
 * Description:       Example block scaffolded with Create Block tool.
 * Requires at least: 6.6
 * Requires PHP:      7.2
 * Version:           0.1.0
 * Author:            The WordPress Contributors
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       mermaid-blocks
 *
 * @package CreateBlock
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

function enqueue_mermaid_blocks_assets() {
	// Enqueue Mermaid.js from a reliable CDN
	wp_enqueue_script(
		'mermaid-js',
		'https://unpkg.com/mermaid@10.2.4/dist/mermaid.min.js',
		[],
		'10.2.4',
		true
	);
}
add_action('enqueue_block_editor_assets', 'enqueue_mermaid_blocks_assets');

