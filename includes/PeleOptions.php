<?php
/**
 * The options a site gives Pele to draw diagrams with.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the `mermaid_blocks_pele_options` filter, and keeps what Pele can use:
 * the known keys, of the right type. The front end and the editor are told the
 * result, only when the renderer is Pele. Diagram authors never set these:
 * they decide what a diagram may do, such as showing links and images.
 */
final class PeleOptions {

	/**
	 * Positive numbers.
	 */
	const NUMBERS = array( 'fontSize', 'padding', 'directionBreakpoint' );

	/**
	 * Positive whole numbers.
	 */
	const INTEGERS = array( 'limit', 'outputLimit', 'maxEdges' );

	/**
	 * True or false.
	 */
	const BOOLEANS = array( 'autoDirection', 'links', 'images' );

	/**
	 * Lists of strings.
	 */
	const LISTS = array( 'linkSchemes', 'imageSchemes' );

	/**
	 * Strings.
	 */
	const STRINGS = array( 'linkRel' );

	/**
	 * The stored settings, which name the renderer.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * Sets up the options.
	 *
	 * @param Options $options The stored settings.
	 */
	public function __construct( Options $options ) {
		$this->options = $options;
	}

	/**
	 * Returns the options to tell the scripts: none with Mermaid.js, and none
	 * when the filter gave nothing Pele can use.
	 *
	 * @return array The options by name; `config` is an object. Empty for none.
	 */
	public function get_settings(): array {
		if ( Renderers::PELE !== $this->options->get_renderer() ) {
			return array();
		}

		return $this->get();
	}

	/**
	 * Adds the options to what a script is told, as `peleOptions`: only with
	 * Pele, and only when the filter gave some.
	 *
	 * @param array $settings What the script is told.
	 *
	 * @return array The settings, with the options when there are some.
	 */
	public function add_to( array $settings ): array {
		$options = $this->get_settings();

		if ( $options ) {
			$settings['peleOptions'] = $options;
		}

		return $settings;
	}

	/**
	 * Returns the options the filter gave, without what Pele can't use.
	 *
	 * @return array The options by name; `config` is an object.
	 */
	private function get(): array {
		/**
		 * Filters the options Pele draws the diagrams of the site with.
		 *
		 * Only the keys below, of the type given here, are kept; anything else
		 * is ignored. The plugin sets `idPrefix`, `responsive`, `fontFamily`,
		 * `fontFamilyMono` and `measurer` itself, and they win over these. The
		 * options only apply when the renderer is Pele.
		 *
		 * - `fontSize`, `padding`, `directionBreakpoint`: positive numbers.
		 * - `autoDirection`, `links`, `images`: true or false.
		 * - `linkSchemes`, `imageSchemes`: lists of URL schemes, such as `https`.
		 * - `linkRel`: the `rel` of links.
		 * - `limit`, `outputLimit`, `maxEdges`: positive whole numbers.
		 * - `config`: an array, Mermaid configuration used by default.
		 *
		 * @param array $options The options by name. Empty by default.
		 */
		$filtered = apply_filters( 'mermaid_blocks_pele_options', array() );

		return is_array( $filtered ) ? $this->sanitize( $filtered ) : array();
	}

	/**
	 * Keeps the known keys of the right type.
	 *
	 * @param array $filtered What the filter gave.
	 *
	 * @return array The options by name.
	 */
	private function sanitize( array $filtered ): array {
		$options = array();

		foreach ( $filtered as $name => $value ) {
			if ( in_array( $name, self::NUMBERS, true ) ) {
				if ( ( is_int( $value ) || is_float( $value ) ) && is_finite( $value ) && $value > 0 ) {
					$options[ $name ] = $value;
				}
			} elseif ( in_array( $name, self::INTEGERS, true ) ) {
				if ( is_int( $value ) && $value > 0 ) {
					$options[ $name ] = $value;
				}
			} elseif ( in_array( $name, self::BOOLEANS, true ) ) {
				if ( is_bool( $value ) ) {
					$options[ $name ] = $value;
				}
			} elseif ( in_array( $name, self::LISTS, true ) ) {
				if ( is_array( $value ) ) {
					$options[ $name ] = array_values( array_filter( $value, 'is_string' ) );
				}
			} elseif ( in_array( $name, self::STRINGS, true ) ) {
				if ( is_string( $value ) ) {
					$options[ $name ] = $value;
				}
			} elseif ( 'config' === $name ) {
				if ( is_array( $value ) ) {
					// An object, even with none.
					$options[ $name ] = (object) $value;
				}
			}
		}

		return $options;
	}
}
