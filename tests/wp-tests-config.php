<?php
/**
 * The configuration of the WordPress the tests run on.
 *
 * The database comes from the environment variables WP_TESTS_DB_NAME,
 * WP_TESTS_DB_USER, WP_TESTS_DB_PASSWORD and WP_TESTS_DB_HOST. The tests drop
 * and create its tables: give them a database of their own.
 *
 * @package GraphDraw
 */

/**
 * Returns the value of an environment variable.
 *
 * @param string $name          The name of the variable.
 * @param string $default_value The value when it isn't set.
 *
 * @return string The value.
 */
function graphdraw_tests_env( $name, $default_value ) {
	$value = getenv( $name );

	return false === $value ? $default_value : $value;
}

// WordPress, as Composer installs it.
define( 'ABSPATH', dirname( __DIR__ ) . '/vendor/roots/wordpress-no-content/' );

// That WordPress has no themes folder, so no theme directory is registered, and WordPress 6.8+ calls wp_is_block_theme() "incorrectly" as it loads. An empty one is enough.
if ( ! is_dir( ABSPATH . 'wp-content/themes' ) ) {
	mkdir( ABSPATH . 'wp-content/themes', 0755, true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_mkdir -- WordPress isn't loaded yet.
}

define( 'DB_NAME', graphdraw_tests_env( 'WP_TESTS_DB_NAME', 'wordpress_tests' ) );
define( 'DB_USER', graphdraw_tests_env( 'WP_TESTS_DB_USER', 'root' ) );
define( 'DB_PASSWORD', graphdraw_tests_env( 'WP_TESTS_DB_PASSWORD', '' ) );
define( 'DB_HOST', graphdraw_tests_env( 'WP_TESTS_DB_HOST', '127.0.0.1' ) );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

define( 'WP_DEBUG', true );
define( 'WP_DEFAULT_THEME', 'default' );
define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Test Blog' );
define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );
