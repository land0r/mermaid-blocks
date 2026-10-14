<?php
/**
 * The Mermaid Diagram widget of Elementor, added to Elementor.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Integrations\Elementor;

use MermaidBlocks\Files;
use MermaidBlocks\Hookable;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the Mermaid Diagram widget with Elementor, and the script that
 * draws its diagrams when Elementor shows one after the page loaded: in the
 * editor's preview after each change, or in a popup.
 *
 * It waits for Elementor's actions, so a site without Elementor never loads
 * it, nor the widget, which only Elementor's own classes can load.
 */
final class Registrar implements Hookable {

	/**
	 * The handle of the script that draws the widget's diagrams.
	 */
	const SCRIPT = 'mermaid-blocks-elementor';

	/**
	 * The plugin's files, to find the script.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * Sets up the widget's registration.
	 *
	 * @param Files $files The plugin's files.
	 */
	public function __construct( Files $files ) {
		$this->files = $files;
	}

	/**
	 * Adds the widget and its script to Elementor.
	 */
	public function hooks(): void {
		// Elementor 3.5 and later.
		add_action( 'elementor/widgets/register', array( $this, 'register_widget' ) );
		// On the front end and in the editor's preview.
		add_action( 'elementor/frontend/after_register_scripts', array( $this, 'register_script' ) );
	}

	/**
	 * Registers the widget. Elementor creates one for each on a page.
	 *
	 * @param \Elementor\Widgets_Manager $widgets The widgets of Elementor.
	 */
	public function register_widget( $widgets ): void {
		$widgets->register( new DiagramWidget() );
	}

	/**
	 * Registers the script that draws the widget's diagrams. The widget
	 * declares it, so Elementor loads it only where the widget is.
	 */
	public function register_script(): void {
		$asset = $this->files->get_build_asset( 'elementor' );

		wp_register_script(
			self::SCRIPT,
			$this->files->get_build_url( 'elementor.js' ),
			array_merge( $asset['dependencies'], array( 'jquery' ) ),
			$asset['version'],
			true
		);
	}
}
