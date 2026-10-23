<?php
/**
 * Removes what the plugin stored when it is deleted: the options of its
 * settings (see MermaidBlocks\Options, which lists them: a unit test tells
 * when one is missing here). Diagrams stay in the posts they were written in.
 *
 * @package MermaidBlocks
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'mermaid_blocks_renderer' );
delete_option( 'mermaid_blocks_code_blocks' );
delete_option( 'mermaid_blocks_theme' );
delete_option( 'mermaid_blocks_save_images' );

/*
 * The saved images of diagrams (see MermaidBlocks\Images\SavedImages): the
 * list each post has of its images, the files, and their directory.
 */
delete_post_meta_by_key( '_mermaid_blocks_images' );

$mermaid_blocks_uploads = wp_get_upload_dir();
$mermaid_blocks_images  = $mermaid_blocks_uploads['basedir'] . '/mermaid-blocks';

if ( is_dir( $mermaid_blocks_images ) ) {
	foreach ( (array) glob( $mermaid_blocks_images . '/*.png' ) as $mermaid_blocks_image ) {
		wp_delete_file( $mermaid_blocks_image );
	}

	// Left in place if something else put a file there.
	@rmdir( $mermaid_blocks_images ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- The plugin's own directory, removed without the filesystem API, which may ask for credentials.
}
