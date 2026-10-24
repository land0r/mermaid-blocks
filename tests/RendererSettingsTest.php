<?php
/**
 * Tests of what a script needs to build its renderer.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Files;
use MermaidBlocks\Options;
use MermaidBlocks\RendererSettings;
use WP_UnitTestCase;

/**
 * What the front end and the editor are told for their renderer.
 *
 * @covers \MermaidBlocks\RendererSettings
 */
class RendererSettingsTest extends WP_UnitTestCase {

	/**
	 * Adds the settings to some others.
	 *
	 * @param array $settings What the script is told already.
	 *
	 * @return array The settings.
	 */
	private function add_to( array $settings = array() ): array {
		return mermaid_blocks()->get( RendererSettings::class )->add_to( $settings );
	}

	/**
	 * The math module is always told, with the version of its build.
	 */
	public function test_tells_where_the_math_module_is(): void {
		$files = mermaid_blocks()->get( Files::class );
		$asset = $files->get_build_asset( 'math' );

		$this->assertNotEmpty( $asset['version'] );
		$this->assertSame(
			$files->get_build_url( 'math.js' ) . '?ver=' . $asset['version'],
			$this->add_to()['mathUrl']
		);
	}

	/**
	 * What the script was told stays, and comes first.
	 */
	public function test_keeps_what_the_script_was_told(): void {
		$this->assertSame( array( 'theme', 'mathUrl' ), array_keys( $this->add_to( array( 'theme' => 'dark' ) ) ) );
	}

	/**
	 * The options of Pele are told only with Pele, and only when there are some.
	 */
	public function test_tells_the_options_of_pele_only_with_pele(): void {
		add_filter(
			'mermaid_blocks_pele_options',
			static function () {
				return array( 'links' => true );
			}
		);

		update_option( Options::RENDERER, 'mermaid' );
		$this->assertArrayNotHasKey( 'peleOptions', $this->add_to() );

		update_option( Options::RENDERER, 'pele' );
		$this->assertSame( array( 'links' => true ), $this->add_to()['peleOptions'] );
	}

	/**
	 * The icon packs are told with either renderer, only when there are some.
	 */
	public function test_tells_the_icon_packs_with_either_renderer(): void {
		$this->assertArrayNotHasKey( 'iconPacks', $this->add_to() );

		add_filter(
			'mermaid_blocks_icon_packs',
			static function () {
				return array( 'fa' => 'https://example.com/fa.json' );
			}
		);

		foreach ( array( 'mermaid', 'pele' ) as $renderer ) {
			update_option( Options::RENDERER, $renderer );
			$this->assertSame( array( 'fa' => 'https://example.com/fa.json' ), $this->add_to()['iconPacks'], $renderer );
		}
	}
}
