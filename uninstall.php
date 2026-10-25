<?php
/**
 * Removes what the plugin stored when it is deleted: the options of its
 * settings (see GraphDraw\Options, which lists them: a unit test tells
 * when one is missing here). Diagrams stay in the posts they were written in.
 *
 * @package GraphDraw
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'graphdraw_renderer' );
delete_option( 'graphdraw_code_blocks' );
delete_option( 'graphdraw_theme' );
delete_option( 'graphdraw_save_images' );

/*
 * The saved images of diagrams (see GraphDraw\Images\SavedImages): the
 * list each post has of its images, the files, and their directory.
 */
delete_post_meta_by_key( '_graphdraw_images' );

$graphdraw_uploads = wp_get_upload_dir();
$graphdraw_images  = $graphdraw_uploads['basedir'] . '/graphdraw';

if ( is_dir( $graphdraw_images ) ) {
	foreach ( (array) glob( $graphdraw_images . '/*.png' ) as $graphdraw_image ) {
		wp_delete_file( $graphdraw_image );
	}

	// Left in place if something else put a file there.
	@rmdir( $graphdraw_images ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- The plugin's own directory, removed without the filesystem API, which may ask for credentials.
}
