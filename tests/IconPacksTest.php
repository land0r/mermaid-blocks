<?php
/**
 * Tests of the icon packs a site registers.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\IconPacks;
use MermaidBlocks\Options;
use WP_UnitTestCase;

/**
 * What the `mermaid_blocks_icon_packs` filter may register, and who is told.
 *
 * @covers \MermaidBlocks\IconPacks
 */
class IconPacksTest extends WP_UnitTestCase {

	/**
	 * Returns the packs after the filter returned some.
	 *
	 * @param mixed $packs What the filter returns.
	 *
	 * @return array The packs.
	 */
	private function filtered( $packs ): array {
		$filter = static function () use ( $packs ) {
			return $packs;
		};

		add_filter( 'mermaid_blocks_icon_packs', $filter );
		$result = mermaid_blocks()->get( IconPacks::class )->get_settings();
		remove_filter( 'mermaid_blocks_icon_packs', $filter );

		return $result;
	}

	/**
	 * Nothing is told without a filter.
	 */
	public function test_is_empty_without_a_filter(): void {
		$this->assertSame( array(), mermaid_blocks()->get( IconPacks::class )->get_settings() );
		$this->assertSame( array( 'a' => 1 ), mermaid_blocks()->get( IconPacks::class )->add_to( array( 'a' => 1 ) ) );
	}

	/**
	 * A name and the URL of its file are kept, with either renderer.
	 */
	public function test_keeps_names_and_urls_with_either_renderer(): void {
		$packs = array(
			'fa'    => 'https://example.com/fa.json',
			'logos' => 'https://example.com/logos.json',
			'my-1'  => '/wp-content/icons.json',
		);

		foreach ( array( 'mermaid', 'pele' ) as $renderer ) {
			update_option( Options::RENDERER, $renderer );

			$this->assertSame( $packs, $this->filtered( $packs ), $renderer );
		}
	}

	/**
	 * Names that are not lower-case letters, digits and hyphens, and values
	 * that are no URL, are dropped; a URL goes through `esc_url_raw()`.
	 */
	public function test_drops_what_is_not_a_pack(): void {
		$packs = $this->filtered(
			array(
				'Fa'     => 'https://example.com/upper.json',
				'a:b'    => 'https://example.com/colon.json',
				''       => 'https://example.com/empty.json',
				'no-url' => 5,
				'js'     => 'javascript:alert(1)',
				'blank'  => '',
				'mail'   => 'mailto:icons@example.com',
				'ftp'    => 'ftp://example.com/icons.json',
				'data'   => 'data:application/json,{}',
				'spaces' => 'https://example.com/a b.json',
				'ok'     => 'https://example.com/ok.json',
				42       => 'https://example.com/number.json',
			)
		);

		$this->assertSame(
			array(
				'spaces' => 'https://example.com/a%20b.json',
				'ok'     => 'https://example.com/ok.json',
				'42'     => 'https://example.com/number.json',
			),
			$packs
		);
	}

	/**
	 * A filter that returns something else than an array gives nothing.
	 */
	public function test_ignores_a_filter_that_returns_no_array(): void {
		$this->assertSame( array(), $this->filtered( 'https://example.com/fa.json' ) );
	}

	/**
	 * The packs are told as `iconPacks`, an object in JSON, and only when
	 * there are some.
	 */
	public function test_adds_the_packs_as_an_object(): void {
		$filter = static function () {
			return array( 'fa' => 'https://example.com/fa.json' );
		};

		add_filter( 'mermaid_blocks_icon_packs', $filter );
		$settings = mermaid_blocks()->get( IconPacks::class )->add_to( array() );
		remove_filter( 'mermaid_blocks_icon_packs', $filter );

		$this->assertSame( '{"iconPacks":{"fa":"https:\/\/example.com\/fa.json"}}', wp_json_encode( $settings ) );
	}
}
