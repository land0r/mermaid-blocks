<?php
/**
 * The themes a diagram can be drawn in.
 *
 * @package GraphDraw
 */

namespace GraphDraw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The themes of the bundled Mermaid, and one that follows the page. It also
 * tells which of them are offered with the request's renderer, and which of
 * them a diagram is drawn in: its own, or else the site's.
 */
final class Themes {

	/**
	 * The theme that follows the page: the theme Mermaid picks for the
	 * diagram's type, or the dark counterpart of that theme where the diagram
	 * sits on a dark background.
	 */
	const AUTO = 'auto';

	/**
	 * The dark themes. Pele draws them in its dark palette, and every other
	 * theme in its light one. isDarkTheme() in src/utils/themes.js tells the
	 * same: a unit test compares the two.
	 */
	const DARK = array( 'dark', 'neo-dark', 'redux-dark', 'redux-dark-color' );

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
			'auto'             => __( 'Automatic', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'default'          => __( 'Default', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'neutral'          => __( 'Neutral', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'dark'             => __( 'Dark', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'forest'           => __( 'Forest', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'base'             => __( 'Base', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'neo'              => __( 'Neo', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'neo-dark'         => __( 'Neo Dark', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'redux'            => __( 'Redux', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'redux-dark'       => __( 'Redux Dark', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'redux-color'      => __( 'Redux Color', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'redux-dark-color' => __( 'Redux Dark Color', 'graphdraw-mermaid-diagrams-flowcharts' ),
		);
	}

	/**
	 * Returns the themes the settings page, the block and the Elementor widget
	 * offer with the request's renderer, in the order they are offered.
	 *
	 * Mermaid.js offers every theme. Pele draws a theme as light or dark, so it
	 * offers the automatic theme, Light and Dark: Mermaid.js's Default and Dark,
	 * under the names of what Pele draws.
	 *
	 * @return array Labels of the themes, by name: names from get_all().
	 */
	public function get_offered(): array {
		$themes = $this->get_all();

		if ( Renderers::PELE !== $this->options->get_renderer() ) {
			return $themes;
		}

		return array(
			self::AUTO => $themes[ self::AUTO ],
			'default'  => __( 'Light', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'dark'     => __( 'Dark', 'graphdraw-mermaid-diagrams-flowcharts' ),
		);
	}

	/**
	 * Returns the themes that aren't offered with the request's renderer, each
	 * with the offered theme it is drawn as.
	 *
	 * A diagram, or the site, may have such a theme from before the site
	 * switched renderer. A picker shows it as that offered theme, and it is
	 * kept until another theme is picked: the diagram looks the same, and gets
	 * its own theme back if the site switches back to Mermaid.js.
	 *
	 * @return array Names from get_offered(), by names from get_all(). None
	 *               with Mermaid.js.
	 */
	public function get_aliases(): array {
		$aliases = array();

		foreach ( array_keys( array_diff_key( $this->get_all(), $this->get_offered() ) ) as $name ) {
			$aliases[ $name ] = in_array( $name, self::DARK, true ) ? 'dark' : 'default';
		}

		return $aliases;
	}

	/**
	 * Returns the offered theme a picker shows a theme as.
	 *
	 * @param string $theme A name from get_all().
	 *
	 * @return string A name from get_offered().
	 */
	public function get_shown( string $theme ): string {
		return $this->get_aliases()[ $theme ] ?? $theme;
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
	 * are drawn in. It is set under Settings > GraphDraw.
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
