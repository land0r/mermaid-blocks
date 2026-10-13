<?php
/**
 * What the block editor needs for the diagram block.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Admin;

use MermaidBlocks\Assets;
use MermaidBlocks\Hookable;
use MermaidBlocks\Integrations\Block;
use MermaidBlocks\Options;
use MermaidBlocks\Themes;
use WP_Block_Type_Registry;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gives the block editor what the preview of a diagram needs: Mermaid in the
 * editor canvas, and the themes, the site's theme and where to change it.
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
	 * Sets up what the editor needs.
	 *
	 * @param Themes       $themes        The themes a diagram can be drawn in.
	 * @param Options      $options       The stored settings.
	 * @param SettingsPage $settings_page The settings page.
	 */
	public function __construct( Themes $themes, Options $options, SettingsPage $settings_page ) {
		$this->themes        = $themes;
		$this->options       = $options;
		$this->settings_page = $settings_page;
	}

	/**
	 * Adds what the editor needs to WordPress.
	 */
	public function hooks(): void {
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_canvas_assets' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'add_editor_settings' ) );
	}

	/**
	 * Enqueues Mermaid in the editor canvas.
	 */
	public function enqueue_canvas_assets(): void {
		/*
		 * Load Mermaid inside the editor canvas iframe, so previews are measured
		 * and rendered in the document they are shown in, as on the front end.
		 * WordPress collects the iframe's assets by firing `enqueue_block_assets`
		 * with block editor scripts switched off, which is the only admin context
		 * where this condition holds. The admin window keeps its own copy through
		 * the editor script's dependency, for editors that are not iframed.
		 */
		if ( is_admin() && ! wp_should_load_block_editor_scripts_and_styles() ) {
			wp_enqueue_script( Assets::MERMAID );
		}
	}

	/**
	 * Tells the editor the themes a diagram can have, the site's theme, which
	 * the preview of a block without a theme of its own is drawn in, and, to
	 * those who may change that one, where. It also tells whether to draw the
	 * images of the diagrams of a post: see Images\ImageSync.
	 */
	public function add_editor_settings(): void {
		$block_type = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );

		if ( ! $block_type ) {
			return;
		}

		$settings = array(
			'themes'      => $this->themes->get_all(),
			'theme'       => $this->themes->get_site_theme(),
			'settingsUrl' => current_user_can( 'manage_options' ) ? $this->settings_page->get_url() : '',
			'saveImages'  => $this->options->is_on( Options::SAVE_IMAGES ),
		);

		// The block's own editor script: `mermaid-js` is the library.
		foreach ( array_diff( $block_type->editor_script_handles, array( Assets::MERMAID ) ) as $handle ) {
			wp_add_inline_script(
				$handle,
				'var mermaidBlocksEditorSettings = ' . wp_json_encode( $settings ) . ';',
				'before'
			);
		}
	}
}
