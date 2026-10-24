<?php
/**
 * Tests of what the block editor gets.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Admin\Editor;
use MermaidBlocks\Admin\SettingsPage;
use MermaidBlocks\Assets;
use MermaidBlocks\Files;
use MermaidBlocks\Integrations\Block;
use MermaidBlocks\Options;
use WP_Block_Type_Registry;
use WP_UnitTestCase;

/**
 * Mermaid in the editor canvas, and what the editor is told about the themes
 * and the settings.
 *
 * @covers \MermaidBlocks\Admin\Editor
 */
class EditorTest extends WP_UnitTestCase {

	/**
	 * What the editor needs.
	 *
	 * @var Editor
	 */
	private Editor $editor;

	/**
	 * Starts as an administrator, with Mermaid not loaded.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->editor = mermaid_blocks()->get( Editor::class );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		delete_option( Options::RENDERER );
		wp_dequeue_script( Assets::MERMAID );
		wp_dequeue_script( Assets::PELE );
	}

	/**
	 * Gives the block the editor scripts it is registered with.
	 */
	public function tear_down(): void {
		$block_type = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );

		$block_type->editor_script_handles = array_values( array_diff( $block_type->editor_script_handles, array( Assets::MERMAID, Assets::PELE ) ) );

		parent::tear_down();
	}

	/**
	 * Returns what the editor script is told.
	 *
	 * @return array The settings printed before the editor script, last.
	 */
	private function get_editor_settings(): array {
		$this->editor->add_editor_settings();

		$handles = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME )->editor_script_handles;
		$before  = (array) wp_scripts()->get_data( end( $handles ), 'before' );

		$this->assertSame( 1, preg_match( '/^var mermaidBlocksEditorSettings = (\{.*\});$/s', (string) end( $before ), $matches ) );

		return json_decode( $matches[1], true );
	}

	/**
	 * The editor is told the themes, the site's theme, and where it is set.
	 */
	public function test_tells_the_editor_the_themes(): void {
		update_option( Options::THEME, 'forest' );

		$settings = $this->get_editor_settings();

		$this->assertSame( mermaid_blocks()->themes()->get_all(), $settings['themes'] );
		$this->assertSame( 'forest', $settings['theme'] );
		$this->assertSame( mermaid_blocks()->get( SettingsPage::class )->get_url(), $settings['settingsUrl'] );
	}

	/**
	 * The editor is told the themes offered with the site's renderer, and
	 * the theme each other one is shown as: none with Mermaid.js, Light or
	 * Dark with Pele. The site's theme is told as it is.
	 */
	public function test_tells_the_editor_the_themes_of_the_renderer(): void {
		update_option( Options::THEME, 'forest' );

		update_option( Options::RENDERER, 'mermaid' );
		$settings = $this->get_editor_settings();
		$this->assertSame( mermaid_blocks()->themes()->get_all(), $settings['themes'] );
		$this->assertSame( array(), $settings['themeAliases'] );

		update_option( Options::RENDERER, 'pele' );
		$settings = $this->get_editor_settings();
		$this->assertSame( array( 'auto', 'default', 'dark' ), array_keys( $settings['themes'] ) );
		$this->assertSame( mermaid_blocks()->themes()->get_aliases(), $settings['themeAliases'] );
		$this->assertSame( 'default', $settings['themeAliases']['forest'] );
		$this->assertSame( 'forest', $settings['theme'] );
		$this->assertArrayNotHasKey( 'rendererHelp', $settings );
	}

	/**
	 * With none, the theme each one that isn't offered is shown as is still
	 * an object, as JavaScript reads it.
	 */
	public function test_tells_the_aliases_as_an_object(): void {
		update_option( Options::RENDERER, 'mermaid' );

		$this->editor->add_editor_settings();

		$handles = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME )->editor_script_handles;
		$before  = (array) wp_scripts()->get_data( end( $handles ), 'before' );

		$this->assertStringContainsString( '"themeAliases":{}', (string) end( $before ) );
	}

	/**
	 * Only those who may change the site's theme are told where.
	 */
	public function test_links_to_the_settings_for_those_who_may_change_them(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->assertSame( '', $this->get_editor_settings()['settingsUrl'] );
	}

	/**
	 * The editor is told to draw the images of diagrams while that setting is
	 * on.
	 */
	public function test_tells_the_editor_whether_to_draw_the_images(): void {
		update_option( Options::SAVE_IMAGES, 1 );
		$this->assertTrue( $this->get_editor_settings()['saveImages'] );

		update_option( Options::SAVE_IMAGES, 0 );
		$this->assertFalse( $this->get_editor_settings()['saveImages'] );
	}

	/**
	 * The editor is told the options a filter gives Pele, with Pele and only
	 * when there are some.
	 */
	public function test_tells_the_editor_the_options_of_pele(): void {
		$filter = static function () {
			return array(
				'padding' => 12,
				'unknown' => 1,
			);
		};

		update_option( Options::RENDERER, 'pele' );
		$this->assertArrayNotHasKey( 'peleOptions', $this->get_editor_settings() );

		add_filter( 'mermaid_blocks_pele_options', $filter );
		$this->assertSame( array( 'padding' => 12 ), $this->get_editor_settings()['peleOptions'] );

		update_option( Options::RENDERER, 'mermaid' );
		$this->assertArrayNotHasKey( 'peleOptions', $this->get_editor_settings() );

		remove_filter( 'mermaid_blocks_pele_options', $filter );
	}

	/**
	 * The script of the editor gets the settings, not the library of the
	 * renderer, which is one of the block's editor scripts too.
	 */
	public function test_tells_the_script_of_the_block(): void {
		foreach ( array( 'mermaid', 'pele' ) as $renderer ) {
			update_option( Options::RENDERER, $renderer );
			$this->editor->add_renderer_to_block();
			$this->get_editor_settings();

			$this->assertEmpty( wp_scripts()->get_data( Assets::MERMAID, 'before' ), $renderer );
			$this->assertEmpty( wp_scripts()->get_data( Assets::PELE, 'before' ), $renderer );
		}
	}

	/**
	 * The block doesn't declare a library as its own dependency: the editor
	 * adds the one of the site's renderer, and Pele's editor loads no
	 * Mermaid.js.
	 */
	public function test_the_block_loads_only_the_chosen_renderer_in_the_editor(): void {
		$block_type = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );
		$metadata   = wp_json_file_decode( mermaid_blocks()->get( Files::class )->get_build_path( 'block.json' ), array( 'associative' => true ) );

		$this->assertNotContains( Assets::MERMAID, (array) $metadata['editorScript'] );
		$this->assertNotContains( Assets::PELE, (array) $metadata['editorScript'] );

		$own = array_values( array_diff( $block_type->editor_script_handles, array( Assets::MERMAID, Assets::PELE ) ) );
		$this->assertCount( 1, $own );

		$this->editor->add_renderer_to_block();
		$this->assertSame( array_merge( array( Assets::MERMAID ), $own ), $block_type->editor_script_handles );

		update_option( Options::RENDERER, 'pele' );
		$this->editor->add_renderer_to_block();
		$this->assertSame( array_merge( array( Assets::PELE ), $own ), $block_type->editor_script_handles );

		// Doing it again changes nothing.
		$this->editor->add_renderer_to_block();
		$this->assertSame( array_merge( array( Assets::PELE ), $own ), $block_type->editor_script_handles );
	}

	/**
	 * A filter that picks the renderer decides what the editor loads too.
	 */
	public function test_the_block_loads_the_renderer_a_filter_picks(): void {
		$filter = static function () {
			return 'pele';
		};
		add_filter( 'mermaid_blocks_renderer', $filter );

		$this->editor->add_renderer_to_block();
		$block_type = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );

		$this->assertContains( Assets::PELE, $block_type->editor_script_handles );
		$this->assertNotContains( Assets::MERMAID, $block_type->editor_script_handles );

		remove_filter( 'mermaid_blocks_renderer', $filter );
	}

	/**
	 * Pele's single-file build is loaded into the editor canvas, and no
	 * Mermaid.js, when Pele is the renderer.
	 */
	public function test_loads_pele_and_not_mermaid_into_the_editor_canvas(): void {
		update_option( Options::RENDERER, 'pele' );
		set_current_screen( 'dashboard' );

		$this->editor->enqueue_canvas_assets();

		$this->assertTrue( wp_script_is( Assets::PELE ) );
		$this->assertFalse( wp_script_is( Assets::MERMAID ) );
		$this->assertStringEndsWith( 'build/pele.global.js', wp_scripts()->registered[ Assets::PELE ]->src );
	}

	/**
	 * Mermaid is loaded into the editor canvas, which WordPress collects the
	 * assets of in the admin with the scripts of the editor itself left out:
	 * not on the front end, and not a second time into the editor's window.
	 */
	public function test_loads_mermaid_into_the_editor_canvas(): void {
		$this->editor->enqueue_canvas_assets();
		$this->assertFalse( wp_script_is( Assets::MERMAID ) );

		set_current_screen( 'dashboard' );

		add_filter( 'should_load_block_editor_scripts_and_styles', '__return_true' );
		$this->editor->enqueue_canvas_assets();
		$this->assertFalse( wp_script_is( Assets::MERMAID ) );

		remove_filter( 'should_load_block_editor_scripts_and_styles', '__return_true' );
		$this->editor->enqueue_canvas_assets();
		$this->assertTrue( wp_script_is( Assets::MERMAID ) );
		$this->assertFalse( wp_script_is( Assets::PELE ) );
	}
}
