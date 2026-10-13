<?php
/**
 * What the tests that look at every class of the plugin share.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * The classes in `includes/`.
 */
trait PluginClasses {

	/**
	 * Returns the classes of the plugin: a file in `includes/` named after a
	 * class holds that class. Interfaces are left out.
	 *
	 * @return string[] The names of the classes, sorted.
	 */
	protected function get_plugin_classes(): array {
		$directory = dirname( __DIR__ ) . '/includes/';
		$classes   = array();

		foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $directory, RecursiveDirectoryIterator::SKIP_DOTS ) ) as $file ) {
			// Not `functions.php`: the autoloader would load it a second time.
			if ( 'php' !== $file->getExtension() || ! ctype_upper( $file->getFilename()[0] ) ) {
				continue;
			}

			$class = 'MermaidBlocks\\' . str_replace( '/', '\\', substr( $file->getPathname(), strlen( $directory ), -4 ) );

			if ( class_exists( $class ) ) {
				$classes[] = $class;
			}
		}

		sort( $classes );

		return $classes;
	}
}
