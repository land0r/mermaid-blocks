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
 * The themes of the bundled Mermaid, and one that follows the page. It also
 * tells which of them a diagram is drawn in: its own, or else the site's.
 */
final class Themes {

	/**
	 * The theme that follows the page: the theme Mermaid picks for the
	 * diagram's type, or the dark counterpart of that theme where the diagram
	 * sits on a dark background.
	 */
	const AUTO = 'auto';

	/**
	 * The stored settings, which hold the site's theme.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * Sets up the themes.
	 *
	 * @param Options $options The stored settings, which hold the site's theme.
	 */
	public function __construct( Options $options ) {
		$this->options = $options;
	}

	/**
	 * Returns the sentence that tells what themes are with the renderer of the
	 * request: Pele has none of its own, so a theme counts as light or dark.
	 *
	 * @return string The sentence, or an empty string for Mermaid.js, which
	 *                draws each theme.
	 */
	public function get_renderer_help(): string {
		if ( Renderers::PELE !== $this->options->get_renderer() ) {
			return '';
		}

		return __( 'With Pele, a theme counts as light or dark.', 'mermaid-blocks' );
	}

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

	/**
	 * Returns the site's theme, which diagrams without a theme of their own
	 * are drawn in. It is set under Settings > Mermaid Blocks.
	 *
	 * @return string A name from get_all().
	 */
	public function get_site_theme(): string {
		$theme = $this->options->get_theme();

		return $this->exists( $theme ) ? $theme : self::AUTO;
	}

	/**
	 * Returns the theme a diagram is drawn in: its own, or else the site's.
	 *
	 * @param mixed $theme Optional. The theme chosen for the diagram.
	 *
	 * @return string A name from get_all().
	 */
	public function resolve( $theme = '' ): string {
		return $this->exists( $theme ) ? $theme : $this->get_site_theme();
	}
}
