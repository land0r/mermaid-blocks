<?php
/**
 * The Mermaid Diagram block.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Integrations;

use GraphDraw\Diagram;
use GraphDraw\DiagramTypes;
use GraphDraw\Files;
use GraphDraw\Hookable;
use GraphDraw\Images\SavedImages;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the block from its metadata in `build/`, with a variation per
 * diagram type, and renders it, with its saved image when it has one. What
 * the block editor needs besides is in Admin\Editor.
 */
final class Block implements Hookable {

	/**
	 * The name of the block.
	 */
	const NAME = 'graphdraw/diagram';

	/**
	 * The plugin's files, to find the block's metadata.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * The diagram markup, which the block outputs.
	 *
	 * @var Diagram
	 */
	private Diagram $diagram;

	/**
	 * The diagram types, which the block's variations start from.
	 *
	 * @var DiagramTypes
	 */
	private DiagramTypes $types;

	/**
	 * The saved images of diagrams, for readers that run no JavaScript.
	 *
	 * @var SavedImages
	 */
	private SavedImages $images;

	/**
	 * Sets up the block.
	 *
	 * @param Files        $files   The plugin's files.
	 * @param Diagram      $diagram The diagram markup.
	 * @param DiagramTypes $types   The diagram types, for the variations.
	 * @param SavedImages  $images  The saved images of diagrams.
	 */
	public function __construct( Files $files, Diagram $diagram, DiagramTypes $types, SavedImages $images ) {
		$this->files   = $files;
		$this->diagram = $diagram;
		$this->types   = $types;
		$this->images  = $images;
	}

	/**
	 * Adds the block to WordPress.
	 */
	public function hooks(): void {
		add_action( 'init', array( $this, 'register' ) );
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
			$this->files->get_build_path(),
			array(
				'render_callback'    => array( $this, 'render' ),
				'variation_callback' => array( $this->types, 'get_variations' ),
			)
		);
	}

	/**
	 * Renders the block: the diagram, in a wrapper with the attributes the
	 * block editor adds, such as its alignment and spacing. A diagram that has
	 * a saved image, in the post it is shown in, carries that too.
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

		$theme = isset( $attributes['theme'] ) && is_string( $attributes['theme'] ) ? $attributes['theme'] : '';

		// What readers that run no JavaScript see instead of the source. A diagram that changed since has none.
		$image = $this->images->find( get_the_ID(), $code, $theme );

		$wrapper = array(
			'class'              => $image ? 'graphdraw-diagram has-image' : 'graphdraw-diagram',
			// The block's own theme, or else the site's.
			'data-mermaid-theme' => $this->diagram->get_theme( $theme ),
		);

		// The controls visitors get, and what assistive technology reads for the diagram. The front-end script adds them to the rendered diagram.
		$wrapper += $this->diagram->get_data_attributes(
			$this->diagram->get_controls( (array) $attributes ),
			isset( $attributes['accTitle'] ) ? $attributes['accTitle'] : '',
			isset( $attributes['accDescr'] ) ? $attributes['accDescr'] : ''
		);

		$caption = isset( $attributes['caption'] ) ? $attributes['caption'] : '';

		if ( ! $image ) {
			return $this->diagram->wrap( get_block_wrapper_attributes( $wrapper ), $code, $caption );
		}

		// The image says what the diagram shows: its description, or else its title.
		$alt = isset( $wrapper['data-mermaid-description'] ) ? $wrapper['data-mermaid-description'] : '';
		if ( '' === $alt && isset( $wrapper['data-mermaid-title'] ) ) {
			$alt = $wrapper['data-mermaid-title'];
		}

		return $this->diagram->wrap(
			get_block_wrapper_attributes( $wrapper ),
			$code,
			$caption,
			$this->diagram->get_image_markup( $image, $alt ),
			$this->images->replaces_source()
		);
	}
}
