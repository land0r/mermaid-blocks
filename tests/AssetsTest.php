<?php
/**
 * Tests of the scripts and styles of diagrams.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Assets;
use MermaidBlocks\Files;
use WP_UnitTestCase;

/**
 * What a page with a diagram loads, and what its script is told to load later.
 *
 * @covers \MermaidBlocks\Assets
 */
class AssetsTest extends WP_UnitTestCase {

	/**
	 * The plugin's files.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * Gets the files.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->files = mermaid_blocks()->get( Files::class );
	}

	/**
	 * Returns what is printed for the front-end script to read.
	 *
	 * @return array The settings.
	 */
	private function get_settings(): array {
		$before = array_filter( (array) wp_scripts()->get_data( Assets::RENDERER, 'before' ) );
		$script = implode( "\n", $before );

		$this->assertSame( 1, preg_match( '/^var mermaidBlocksSettings = (\{.*\});$/s', $script, $matches ) );

		return json_decode( $matches[1], true );
	}

	/**
	 * The script gets the URL of Mermaid's ES module build, with its version.
	 */
	public function test_says_where_mermaid_is(): void {
		$version = $this->files->get_build_asset( 'mermaid' )['version'];

		$this->assertNotEmpty( $version );
		$this->assertFileExists( $this->files->get_build_path( 'mermaid/mermaid.esm.min.js' ) );
		$this->assertSame(
			$this->files->get_build_url( 'mermaid/mermaid.esm.min.js' ) . '?ver=' . $version,
			$this->get_settings()['mermaidUrl']
		);
	}

	/**
	 * The controls are a module of their own, which the script imports by its
	 * URL, with the version of that file.
	 */
	public function test_says_where_the_controls_are(): void {
		$asset = $this->files->get_build_asset( 'controls' );

		$this->assertNotEmpty( $asset['version'] );
		$this->assertSame( 'module', $asset['type'] );
		$this->assertFileExists( $this->files->get_build_path( 'controls.js' ) );
		$this->assertSame(
			$this->files->get_build_url( 'controls.js' ) . '?ver=' . $asset['version'],
			$this->get_settings()['controlsUrl']
		);
	}

	/**
	 * The script gets the labels of the controls, which it can't translate.
	 */
	public function test_passes_the_labels_of_the_controls(): void {
		$labels = $this->get_settings()['i18n'];

		$this->assertSame( 'Zoom in', $labels['zoomIn'] );
		$this->assertSame( 'View fullscreen', $labels['fullscreen'] );
	}

	/**
	 * A page with a diagram loads the script alone: it loads Mermaid and the
	 * controls itself, when a diagram needs them.
	 */
	public function test_script_has_no_dependencies(): void {
		$script = wp_scripts()->registered[ Assets::RENDERER ];

		$this->assertSame( array(), $script->deps );
		$this->assertStringEndsWith( 'build/view.js', $script->src );
	}

	/**
	 * The library the editor loads is not what the front end imports.
	 */
	public function test_keeps_the_editors_mermaid_apart(): void {
		$script = wp_scripts()->registered[ Assets::MERMAID ];

		$this->assertStringEndsWith( 'build/mermaid.min.js', $script->src );
		$this->assertStringNotContainsString( 'mermaid.min.js', $this->get_settings()['mermaidUrl'] );
	}

	/**
	 * Diagram markup loads the script and the style that render it.
	 */
	public function test_enqueues_what_renders_diagrams(): void {
		wp_dequeue_script( Assets::RENDERER );
		wp_dequeue_style( Assets::RENDERER );

		mermaid_blocks()->get( Assets::class )->enqueue_renderer();

		$this->assertTrue( wp_script_is( Assets::RENDERER ) );
		$this->assertTrue( wp_style_is( Assets::RENDERER ) );
	}
}
