<?php
/**
 * Tests of the scripts and styles of diagrams.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Assets;
use MermaidBlocks\Files;
use MermaidBlocks\Options;
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

		delete_option( Options::RENDERER );

		$this->files = mermaid_blocks()->get( Files::class );
	}

	/**
	 * Returns what is printed for the front-end script to read.
	 *
	 * @return array The settings.
	 */
	private function get_settings(): array {
		// Told when the page's scripts are enqueued, once the query ran.
		wp_scripts()->add_data( Assets::DIAGRAM, 'before', array() );
		mermaid_blocks()->get( Assets::class )->add_settings();

		$before = array_filter( (array) wp_scripts()->get_data( Assets::DIAGRAM, 'before' ) );
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
	 * The script gets the URL of Pele's lazy build, with its version, and
	 * the renderer to load: Mermaid.js unless the site chose Pele.
	 */
	public function test_says_the_renderer_and_where_pele_is(): void {
		$version = $this->files->get_build_asset( 'pele' )['version'];

		$this->assertNotEmpty( $version );
		$this->assertFileExists( $this->files->get_build_path( 'pele/lazy.js' ) );
		$this->assertFileExists( $this->files->get_build_path( 'pele.global.js' ) );

		$settings = $this->get_settings();

		$this->assertSame( 'mermaid', $settings['renderer'] );
		$this->assertSame(
			$this->files->get_build_url( 'pele/lazy.js' ) . '?ver=' . $version,
			$settings['peleUrl']
		);

		update_option( Options::RENDERER, 'pele' );
		$this->assertSame( 'pele', $this->get_settings()['renderer'] );
	}

	/**
	 * The script is told the options a filter gives Pele, with Pele and only
	 * when there are some.
	 */
	public function test_tells_the_script_the_options_of_pele(): void {
		$filter = static function () {
			return array(
				'links'   => true,
				'unknown' => 1,
			);
		};

		update_option( Options::RENDERER, 'pele' );
		$this->assertArrayNotHasKey( 'peleOptions', $this->get_settings() );

		add_filter( 'mermaid_blocks_pele_options', $filter );
		$this->assertSame( array( 'links' => true ), $this->get_settings()['peleOptions'] );

		update_option( Options::RENDERER, 'mermaid' );
		$this->assertArrayNotHasKey( 'peleOptions', $this->get_settings() );

		remove_filter( 'mermaid_blocks_pele_options', $filter );
	}

	/**
	 * The renderer a filter picks is the one the script is told, even for a
	 * request the filter looks at once the query ran.
	 */
	public function test_tells_the_renderer_the_filter_picks(): void {
		$filter = static function () {
			return 'pele';
		};
		add_filter( 'mermaid_blocks_renderer', $filter );

		$this->assertSame( 'pele', $this->get_settings()['renderer'] );

		remove_filter( 'mermaid_blocks_renderer', $filter );
	}

	/**
	 * The scripts are told when they are enqueued on the front end.
	 */
	public function test_tells_the_script_when_scripts_are_enqueued(): void {
		wp_scripts()->add_data( Assets::DIAGRAM, 'before', array() );

		do_action( 'wp_enqueue_scripts' );

		$before = array_filter( (array) wp_scripts()->get_data( Assets::DIAGRAM, 'before' ) );
		$this->assertStringContainsString( 'var mermaidBlocksSettings = ', implode( "\n", $before ) );
	}

	/**
	 * A diagram shown in the admin, such as in the preview of a page builder,
	 * is told the same, once however many actions enqueue the script.
	 */
	public function test_tells_the_script_when_scripts_are_enqueued_in_the_admin(): void {
		set_current_screen( 'dashboard' );
		wp_scripts()->add_data( Assets::DIAGRAM, 'before', array() );

		do_action( 'admin_enqueue_scripts', 'index.php' );
		do_action( 'wp_enqueue_scripts' );
		do_action( 'admin_enqueue_scripts', 'index.php' );

		$before = array_filter( (array) wp_scripts()->get_data( Assets::DIAGRAM, 'before' ) );

		$this->assertSame( 1, substr_count( implode( "\n", $before ), 'var mermaidBlocksSettings = ' ) );

		set_current_screen( 'front' );
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
	 * The math module is a module of its own, which Pele diagrams import by its
	 * URL, with the version of that file. It is told whatever the renderer is:
	 * as Pele's URL is.
	 */
	public function test_says_where_the_math_module_is(): void {
		$asset = $this->files->get_build_asset( 'math' );

		$this->assertNotEmpty( $asset['version'] );
		$this->assertSame( 'module', $asset['type'] );
		$this->assertFileExists( $this->files->get_build_path( 'math.js' ) );
		$this->assertSame(
			$this->files->get_build_url( 'math.js' ) . '?ver=' . $asset['version'],
			$this->get_settings()['mathUrl']
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
		$script = wp_scripts()->registered[ Assets::DIAGRAM ];

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
	 * Pele's single-file build is the editor's, apart from the lazy build the
	 * front end imports.
	 */
	public function test_registers_the_pele_library_for_the_editor(): void {
		$script = wp_scripts()->registered[ Assets::PELE ];

		$this->assertStringEndsWith( 'build/pele.global.js', $script->src );
		$this->assertSame( $this->files->get_build_asset( 'pele' )['version'], $script->ver );
		$this->assertSame( array(), $script->deps );
	}

	/**
	 * Diagram markup loads the script and the style that render it.
	 */
	public function test_enqueues_what_renders_diagrams(): void {
		wp_dequeue_script( Assets::DIAGRAM );
		wp_dequeue_style( Assets::DIAGRAM );

		mermaid_blocks()->get( Assets::class )->enqueue_diagram();

		$this->assertTrue( wp_script_is( Assets::DIAGRAM ) );
		$this->assertTrue( wp_style_is( Assets::DIAGRAM ) );
	}
}
