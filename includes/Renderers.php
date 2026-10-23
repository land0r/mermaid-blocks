<?php
/**
 * The renderers a site can draw its diagrams with.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The names of the renderers: Mermaid.js, the default, and Pele. A renderer
 * draws every diagram of a site, in the editor and on the front end.
 */
final class Renderers {

	/**
	 * Mermaid.js, the renderer made by the Mermaid project.
	 */
	const MERMAID = 'mermaid';

	/**
	 * Pele, the renderer made by Obsidian.
	 */
	const PELE = 'pele';

	/**
	 * Every renderer.
	 */
	const ALL = array( self::MERMAID, self::PELE );

	/**
	 * Tells whether a value names a renderer.
	 *
	 * @param mixed $name The value.
	 *
	 * @return bool Whether it is the name of a renderer.
	 */
	public static function exists( $name ): bool {
		return is_string( $name ) && in_array( $name, self::ALL, true );
	}
}
