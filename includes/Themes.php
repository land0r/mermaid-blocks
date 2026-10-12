<?php
/**
 * The themes a diagram can be drawn in.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The themes of the bundled Mermaid, and one that follows the page.
 */
final class Themes {

	/**
	 * The theme that follows the page: the theme Mermaid picks for the
	 * diagram's type, or the dark counterpart of that theme where the diagram
	 * sits on a dark background.
	 */
	const AUTO = 'auto';

	/**
	 * Returns the themes a diagram can be drawn in, in the order they are
	 * offered.
	 *
	 * The automatic theme comes first. The others are the themes of the
	 * bundled Mermaid, all of them. THEMES in src/utils/themes.js lists the
	 * same names: a unit test compares the two, and both with Mermaid.
	 *
	 * @return array Labels of the themes, by name.
	 */
	public function get_all(): array {
		return array(
			'auto'             => __( 'Automatic', 'mermaid-blocks' ),
			'default'          => __( 'Default', 'mermaid-blocks' ),
			'neutral'          => __( 'Neutral', 'mermaid-blocks' ),
			'dark'             => __( 'Dark', 'mermaid-blocks' ),
			'forest'           => __( 'Forest', 'mermaid-blocks' ),
			'base'             => __( 'Base', 'mermaid-blocks' ),
			'neo'              => __( 'Neo', 'mermaid-blocks' ),
			'neo-dark'         => __( 'Neo Dark', 'mermaid-blocks' ),
			'redux'            => __( 'Redux', 'mermaid-blocks' ),
			'redux-dark'       => __( 'Redux Dark', 'mermaid-blocks' ),
			'redux-color'      => __( 'Redux Color', 'mermaid-blocks' ),
			'redux-dark-color' => __( 'Redux Dark Color', 'mermaid-blocks' ),
		);
	}

	/**
	 * Tells whether a value is the name of a theme.
	 *
	 * @param mixed $theme A value, such as a block attribute or an option.
	 *
	 * @return bool True for a name from get_all().
	 */
	public function exists( $theme ): bool {
		return is_string( $theme ) && array_key_exists( $theme, $this->get_all() );
	}
}
