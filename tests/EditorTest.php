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
		wp_dequeue_script( Assets::MERMAID );
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
	 * The editor is told the renderer.
	 */
	public function test_tells_the_editor_the_renderer(): void {
		update_option( Options::RENDERER, 'mermaid' );
		$this->assertSame( 'mermaid', $this->get_editor_settings()['renderer'] );

		update_option( Options::RENDERER, 'pele' );
		$this->assertSame( 'pele', $this->get_editor_settings()['renderer'] );
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
	 * The script of the editor gets the settings, not the Mermaid library,
	 * which is one of the block's editor scripts too.
	 */
	public function test_tells_the_script_of_the_block(): void {
		$this->get_editor_settings();

		$this->assertEmpty( wp_scripts()->get_data( Assets::MERMAID, 'before' ) );
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
	}
}
