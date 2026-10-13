<?php
/**
 * The Mermaid Diagram block.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

use WP_Block_Type_Registry;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the block from its metadata in `build/`, with a variation per
 * diagram type, renders it, and gives the editor what its preview needs.
 */
final class Block {

	/**
	 * The name of the block.
	 */
	const NAME = 'mermaid-blocks/diagram';

	/**
	 * The assets of diagrams, the block's among them.
	 *
	 * @var Assets
	 */
	private Assets $assets;

	/**
	 * The diagram markup, which the block outputs.
	 *
	 * @var Diagram
	 */
	private Diagram $diagram;

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * The settings, which hold the site's theme.
	 *
	 * @var Settings
	 */
	private Settings $settings;

	/**
	 * The diagram types, which the block's variations start from.
	 *
	 * @var DiagramTypes
	 */
	private DiagramTypes $types;

	/**
	 * Sets up the block.
	 *
	 * @param Assets       $assets   The assets of diagrams.
	 * @param Diagram      $diagram  The diagram markup.
	 * @param Themes       $themes   The themes a diagram can be drawn in.
	 * @param Settings     $settings The settings, which hold the site's theme.
	 * @param DiagramTypes $types    The diagram types, for the variations.
	 */
	public function __construct( Assets $assets, Diagram $diagram, Themes $themes, Settings $settings, DiagramTypes $types ) {
		$this->assets   = $assets;
		$this->diagram  = $diagram;
		$this->themes   = $themes;
		$this->settings = $settings;
		$this->types    = $types;
	}

	/**
	 * Adds the block, and what its editor needs, to WordPress.
	 */
	public function hooks(): void {
		add_action( 'init', array( $this, 'register' ) );
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_canvas_assets' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'add_editor_settings' ) );
	}

	/**
	 * Registers the block using the metadata loaded from `build/block.json`.
	 * Behind the scenes, it registers also all assets so they can be enqueued
	 * through the block editor in the corresponding context.
	 *
	 * The variations are built when the editor asks for them, so their texts
	 * are translated.
	 *
	 * @see https://developer.wordpress.org/reference/functions/register_block_type/
	 */
	public function register(): void {
		register_block_type(
			$this->assets->get_path(),
			array(
				'render_callback'    => array( $this, 'render' ),
				'variation_callback' => array( $this->types, 'get_variations' ),
			)
		);
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
	 * those who may change that one, where.
	 */
	public function add_editor_settings(): void {
		$block_type = WP_Block_Type_Registry::get_instance()->get_registered( self::NAME );

		if ( ! $block_type ) {
			return;
		}

		$settings = array(
			'themes'      => $this->themes->get_all(),
			'theme'       => $this->settings->get_theme(),
			'settingsUrl' => current_user_can( 'manage_options' ) ? $this->settings->get_url() : '',
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

	/**
	 * Renders the block: the diagram, in a wrapper with the attributes the
	 * block editor adds, such as its alignment and spacing.
	 *
	 * @param array $attributes The attributes of the block.
	 *
	 * @return string The markup, or an empty string when there is no code.
	 */
	public function render( $attributes ): string {
		$code = isset( $attributes['code'] ) ? (string) $attributes['code'] : '';

		if ( '' === trim( $code ) ) {
			return '';
		}

		$wrapper = array(
			'class'              => 'mermaid-blocks-diagram',
			// The block's own theme, or else the site's.
			'data-mermaid-theme' => $this->diagram->get_theme( isset( $attributes['theme'] ) ? $attributes['theme'] : '' ),
		);

		// The controls visitors get. The front-end script adds them to the rendered diagram.
		$controls = array();
		foreach ( Diagram::CONTROLS as $control ) {
			if ( ! empty( $attributes[ $control ] ) ) {
				$controls[] = $control;
			}
		}

		if ( $controls ) {
			$wrapper['data-mermaid-controls'] = implode( ' ', $controls );
		}

		// What assistive technology reads for the diagram. The front-end script writes both into the rendered SVG.
		$texts = array(
			'accTitle' => 'data-mermaid-title',
			'accDescr' => 'data-mermaid-description',
		);
		foreach ( $texts as $text => $name ) {
			$value = isset( $attributes[ $text ] ) ? trim( (string) $attributes[ $text ] ) : '';

			if ( '' !== $value ) {
				$wrapper[ $name ] = $value;
			}
		}

		return $this->diagram->wrap(
			get_block_wrapper_attributes( $wrapper ),
			$code,
			isset( $attributes['caption'] ) ? $attributes['caption'] : ''
		);
	}
}
