<?php
/**
 * Removes what the plugin stored when it is deleted: the options of its
 * settings (see MermaidBlocks\Settings). Diagrams stay in the posts they were
 * written in.
 *
 * @package MermaidBlocks
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'mermaid_blocks_theme' );
