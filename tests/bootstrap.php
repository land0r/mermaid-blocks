<?php
/**
 * Loads WordPress's test library, with the plugin active.
 *
 * The database comes from environment variables: see wp-tests-config.php.
 *
 * @package GraphDraw
 */

$graphdraw_root = dirname( __DIR__ );

// Without its build, the plugin shows a notice instead of loading, and every test fails for that.
if ( ! file_exists( $graphdraw_root . '/build/block.json' ) ) {
	echo 'The plugin has no build: run `npm run build` before the PHP tests.' . PHP_EOL; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Console output.
	exit( 1 );
}

// The test library reads this configuration through its own, which finds it in the environment.
putenv( 'WP_PHPUNIT__TESTS_CONFIG=' . __DIR__ . '/wp-tests-config.php' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.runtime_configuration_putenv

// Composer's autoloader loads the PHPUnit Polyfills, which the library needs.
require_once $graphdraw_root . '/vendor/autoload.php';
require_once $graphdraw_root . '/vendor/wp-phpunit/wp-phpunit/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () use ( $graphdraw_root ) {
		// The tests of the Elementor widget run with Elementor, a development dependency, active (phpunit-elementor.xml.dist). The others run as on a site without it.
		if ( getenv( 'GRAPHDRAW_TESTS_ELEMENTOR' ) ) {
			require $graphdraw_root . '/vendor/wordpress-plugin/elementor/elementor.php';
		}

		require $graphdraw_root . '/graphdraw-mermaid-diagrams-flowcharts.php';
	}
);

require $graphdraw_root . '/vendor/wp-phpunit/wp-phpunit/includes/bootstrap.php';
