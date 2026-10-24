<?php
/**
 * Tests of the options a site gives Pele.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Options;
use MermaidBlocks\PeleOptions;
use WP_UnitTestCase;

/**
 * What the `mermaid_blocks_pele_options` filter may set, and who is told.
 *
 * @covers \MermaidBlocks\PeleOptions
 */
class PeleOptionsTest extends WP_UnitTestCase {

	/**
	 * Starts with Pele as the renderer.
	 */
	public function set_up(): void {
		parent::set_up();

		update_option( Options::RENDERER, 'pele' );
	}

	/**
	 * Returns the options after the filter returned some.
	 *
	 * @param mixed $options What the filter returns.
	 *
	 * @return array The options.
	 */
	private function filtered( $options ): array {
		add_filter(
			'mermaid_blocks_pele_options',
			static function () use ( $options ) {
				return $options;
			}
		);

		return mermaid_blocks()->get( PeleOptions::class )->get_settings();
	}

	/**
	 * Nothing is told without a filter.
	 */
	public function test_is_empty_without_a_filter(): void {
		$this->assertSame( array(), mermaid_blocks()->get( PeleOptions::class )->get_settings() );
	}

	/**
	 * Keys Pele knows, of the right type, are kept.
	 */
	public function test_keeps_the_known_keys_of_the_right_type(): void {
		$options = array(
			'fontSize'            => 14,
			'padding'             => 7.5,
			'directionBreakpoint' => 500,
			'autoDirection'       => false,
			'links'               => true,
			'images'              => true,
			'linkSchemes'         => array( 'https', 'mailto' ),
			'imageSchemes'        => array( 'https' ),
			'linkRel'             => 'noopener nofollow',
			'limit'               => 1000,
			'outputLimit'         => 2000,
			'maxEdges'            => 300,
		);

		$this->assertSame( $options, $this->filtered( $options ) );
	}

	/**
	 * The default Mermaid configuration reaches the script as an object, also
	 * when it is empty, which an array would not.
	 */
	public function test_gives_config_as_an_object(): void {
		$settings = $this->filtered( array( 'config' => array( 'flowchart' => array( 'padding' => 5 ) ) ) );

		$this->assertSame( '{"config":{"flowchart":{"padding":5}}}', wp_json_encode( $settings ) );
		$this->assertSame( '{"config":{}}', wp_json_encode( $this->filtered( array( 'config' => array() ) ) ) );
	}

	/**
	 * Values of the wrong type, keys Pele has no use for here, and the plugin's
	 * own options are dropped.
	 */
	public function test_drops_what_pele_cannot_use(): void {
		$settings = $this->filtered(
			array(
				'fontSize'            => '14',
				'padding'             => -1,
				'directionBreakpoint' => 0,
				'autoDirection'       => 'no',
				'links'               => 1,
				'images'              => null,
				'linkSchemes'         => 'https',
				'imageSchemes'        => array( 'https' ),
				'linkRel'             => array( 'nofollow' ),
				'limit'               => 1.5,
				'outputLimit'         => '2000',
				'maxEdges'            => -5,
				'config'              => 'flowchart',
				'idPrefix'            => 'mine',
				'responsive'          => false,
				'fontFamily'          => 'Comic Sans MS',
				'measurer'            => 'x',
				'unknown'             => true,
			)
		);

		$this->assertSame( array( 'imageSchemes' => array( 'https' ) ), $settings );
	}

	/**
	 * A list with an item that is no string is ignored as a whole, not kept as
	 * a shorter list: an empty `linkSchemes` turns every link off.
	 */
	public function test_ignores_a_list_with_an_item_that_is_no_string(): void {
		$settings = $this->filtered(
			array(
				'linkSchemes'  => array( 5 ),
				'imageSchemes' => array( 'https', array() ),
			)
		);

		$this->assertSame( array(), $settings );
	}

	/**
	 * A filter that returns something else than an array gives nothing.
	 */
	public function test_ignores_a_filter_that_returns_no_array(): void {
		$this->assertSame( array(), $this->filtered( 'links' ) );
	}

	/**
	 * Mermaid.js is told nothing.
	 */
	public function test_is_empty_with_mermaid(): void {
		update_option( Options::RENDERER, 'mermaid' );

		$this->assertSame( array(), $this->filtered( array( 'links' => true ) ) );
	}
}
