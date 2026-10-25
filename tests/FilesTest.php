<?php
/**
 * Tests of where the plugin's files are.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use GraphDraw\Files;
use WP_UnitTestCase;

/**
 * The paths and the URLs of what the build generated.
 *
 * @covers \GraphDraw\Files
 */
class FilesTest extends WP_UnitTestCase {

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

		$this->files = graphdraw()->get( Files::class );
	}

	/**
	 * The plugin is known to WordPress by its folder and main file.
	 */
	public function test_knows_the_name_of_the_plugin(): void {
		$this->assertSame( plugin_basename( GRAPHDRAW_PLUGIN_FILE ), $this->files->get_basename() );
		$this->assertStringEndsWith( '/graphdraw-mermaid-diagrams-flowcharts.php', $this->files->get_basename() );
	}

	/**
	 * A file of the build has a path and a URL, and so has `build/` itself.
	 */
	public function test_finds_the_files_of_the_build(): void {
		$this->assertSame( dirname( GRAPHDRAW_PLUGIN_FILE ) . '/build/', $this->files->get_build_path() );
		$this->assertFileExists( $this->files->get_build_path( 'block.json' ) );
		$this->assertSame( plugins_url( 'build/view.js', GRAPHDRAW_PLUGIN_FILE ), $this->files->get_build_url( 'view.js' ) );
		$this->assertStringEndsWith( '/build/', $this->files->get_build_url() );
	}

	/**
	 * An asset file gives the version and the dependencies of a built file.
	 * One that is missing gives no version and no dependencies.
	 */
	public function test_reads_an_asset_file(): void {
		$asset = $this->files->get_build_asset( 'view' );

		$this->assertNotEmpty( $asset['version'] );
		$this->assertSame( array(), $asset['dependencies'] );
		$this->assertSame(
			array(
				'dependencies' => array(),
				'version'      => false,
			),
			$this->files->get_build_asset( 'no-such-entry' )
		);
	}
}
