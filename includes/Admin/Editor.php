<?php
/**
 * What the block editor needs for the diagram block.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Admin;

use GraphDraw\Assets;
use GraphDraw\Hookable;
use GraphDraw\Integrations\Block;
use GraphDraw\Options;
use GraphDraw\RendererSettings;
use GraphDraw\Themes;
use WP_Block_Type_Registry;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gives the block editor what the preview of a diagram needs: the site's
 * renderer in the editor canvas, and the themes, the site's theme and where to change it.
 */
final class Editor implements Hookable {

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * The stored settings, which tell whether images of diagrams are saved.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * The settings page, which the editor links to.
	 *
	 * @var SettingsPage
	 */
	private SettingsPage $settings_page;

	/**
	 * What a script needs to build its renderer.
	 *
	 * @var RendererSettings
	 */
	private RendererSettings $renderer_settings;

	/**
	 * Sets up what the editor needs.
	 *
	 * @param Themes           $themes            The themes a diagram can be drawn in.
	 * @param Options          $options           The stored settings.
	 * @param SettingsPage     $settings_page     The settings page.
	 * @param RendererSettings $renderer_settings What a script needs to build its renderer.
	 */
	public function __construct( Themes $themes, Options $options, SettingsPage $settings_page, RendererSettings $renderer_settings ) {
		$this->themes            = $themes;
		$this->options           = $options;
		$this->settings_page     = $settings_page;
		$this->renderer_settings = $renderer_settings;
	}

	/**
	 * Adds what the editor needs to WordPress.
	 */
	public function hooks(): void {
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_canvas_assets' ) );

		// Before WordPress enqueues the block's scripts, at the default priority.
		add_action( 'enqueue_block_editor_assets', array( $this, 'add_renderer_to_block' ), 5 );
		add_action( 'enqueue_block_editor_assets', array( $this, 'add_editor_settings' ) );
	}

	/**
	 * Returns the handle of the library of the site's renderer.
	 *
	 * @return string The handle of Mermaid.js's or of Pele's single-file build.
	 */
	private function get_renderer_handle(): string {
		return Assets::LIBRARIES[ $this->options->get_renderer() ];
	}

	/**
	 * Makes the block's editor script load the site's renderer, and not the
	 * other: the block doesn't depend on a library of its own, in
	 * `block.json`, so the admin window loads one only for the editors that
	 * are not iframed to draw their previews in, and the editor canvas gets
	 * its own copy: see enqueue_canvas_assets().
	 */
	public function add_renderer_to_block(): void {
		$block_type = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );

		if ( ! $block_type ) {
			return;
		}

		$handles = array_diff( $block_type->editor_script_handles, Assets::LIBRARIES );

		$block_type->editor_script_handles = array_merge( array( $this->get_renderer_handle() ), $handles );
	}

	/**
	 * Enqueues the site's renderer in the editor canvas.
	 */
	public function enqueue_canvas_assets(): void {
		/*
		 * Load the renderer inside the editor canvas iframe, so previews are measured
		 * and rendered in the document they are shown in, as on the front end.
		 * WordPress collects the iframe's assets by firing `enqueue_block_assets`
		 * with block editor scripts switched off, which is the only admin context
		 * where this condition holds. The admin window keeps its own copy through
		 * the editor script's dependency, for editors that are not iframed.
		 */
		if ( is_admin() && ! wp_should_load_block_editor_scripts_and_styles() ) {
			wp_enqueue_script( $this->get_renderer_handle() );
		}
	}

	/**
	 * Tells the editor the themes offered with the site's renderer, the theme
	 * each one that isn't offered is shown as, the site's theme, which the
	 * preview of a block without a theme of its own is drawn in, and, to those
	 * who may change that one, where. It also tells whether to draw the images
	 * of the diagrams of a post: see Images\ImageSync. With Pele, it also
	 * tells the options the site gives it. The icon packs the site registers
	 * are told with either renderer.
	 */
	public function add_editor_settings(): void {
		$block_type = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );

		if ( ! $block_type ) {
			return;
		}

		$settings = $this->renderer_settings->add_to(
			array(
				'themes'       => $this->themes->get_offered(),
				// An object, even with none.
				'themeAliases' => (object) $this->themes->get_aliases(),
				'theme'        => $this->themes->get_site_theme(),
				'settingsUrl'  => current_user_can( 'manage_options' ) ? $this->settings_page->get_url() : '',
				'saveImages'   => $this->options->is_on( Options::SAVE_IMAGES ),
			)
		);

		// The block's own editor script: the libraries are not.
		foreach ( array_diff( $block_type->editor_script_handles, Assets::LIBRARIES ) as $handle ) {
			wp_add_inline_script(
				$handle,
				'var graphDrawEditorSettings = ' . wp_json_encode( $settings ) . ';',
				'before'
			);
		}
	}
}
