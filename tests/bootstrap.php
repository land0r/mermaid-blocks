<?php
/**
 * Loads WordPress's test library, with the plugin active.
 *
 * The database comes from environment variables: see wp-tests-config.php.
 *
 * @package MermaidBlocks
 */

$mermaid_blocks_root = dirname( __DIR__ );

// Without its build, the plugin shows a notice instead of loading, and every test fails for that.
if ( ! file_exists( $mermaid_blocks_root . '/build/block.json' ) ) {
	echo 'The plugin has no build: run `npm run build` before the PHP tests.' . PHP_EOL; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Console output.
	exit( 1 );
}

// The test library reads this configuration through its own, which finds it in the environment.
putenv( 'WP_PHPUNIT__TESTS_CONFIG=' . __DIR__ . '/wp-tests-config.php' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.runtime_configuration_putenv

// Composer's autoloader loads the PHPUnit Polyfills, which the library needs.
require_once $mermaid_blocks_root . '/vendor/autoload.php';
require_once $mermaid_blocks_root . '/vendor/wp-phpunit/wp-phpunit/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () use ( $mermaid_blocks_root ) {
		require $mermaid_blocks_root . '/mermaid-blocks.php';
	}
);

require $mermaid_blocks_root . '/vendor/wp-phpunit/wp-phpunit/includes/bootstrap.php';
