<?php
/**
 * The Mermaid Diagram widget of Elementor, added to Elementor.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Integrations\Elementor;

use GraphDraw\Files;
use GraphDraw\Hookable;
use GraphDraw\Themes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the Mermaid Diagram widget with Elementor, and the script that
 * draws its diagrams when Elementor shows one after the page loaded: in the
 * editor's preview after each change, or in a popup. In Elementor's editor,
 * it loads the script that shows a widget's theme the site's renderer doesn't
 * offer as the one it is drawn as.
 *
 * It waits for Elementor's actions, so a site without Elementor never loads
 * it, nor the widget, which only Elementor's own classes can load.
 */
final class Registrar implements Hookable {

	/**
	 * The handle of the script that draws the widget's diagrams.
	 */
	const SCRIPT = 'graphdraw-elementor';

	/**
	 * The handle of the script of Elementor's editor.
	 */
	const EDITOR_SCRIPT = 'graphdraw-elementor-editor';

	/**
	 * The plugin's files, to find the scripts.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * The themes, to tell the editor's script those that aren't offered.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * Sets up the widget's registration.
	 *
	 * @param Files  $files  The plugin's files.
	 * @param Themes $themes The themes.
	 */
	public function __construct( Files $files, Themes $themes ) {
		$this->files  = $files;
		$this->themes = $themes;
	}

	/**
	 * Adds the widget and its script to Elementor.
	 */
	public function hooks(): void {
		// Elementor 3.5 and later.
		add_action( 'elementor/widgets/register', array( $this, 'register_widget' ) );
		// On the front end and in the editor's preview.
		add_action( 'elementor/frontend/after_register_scripts', array( $this, 'register_script' ) );
		add_action( 'elementor/editor/after_enqueue_scripts', array( $this, 'enqueue_editor_script' ) );
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

	/**
	 * Loads the script that shows a widget's theme the site's renderer doesn't
	 * offer as the one it is drawn as, with the themes it needs, in Elementor's
	 * editor. With a renderer that offers every theme, it isn't loaded.
	 */
	public function enqueue_editor_script(): void {
		$aliases = $this->themes->get_aliases();

		if ( ! $aliases ) {
			return;
		}

		$asset = $this->files->get_build_asset( 'elementor-editor' );

		wp_enqueue_script(
			self::EDITOR_SCRIPT,
			$this->files->get_build_url( 'elementor-editor.js' ),
			// Elementor's editor, which it adds to.
			array_merge( $asset['dependencies'], array( 'elementor-editor' ) ),
			$asset['version'],
			true
		);

		wp_add_inline_script(
			self::EDITOR_SCRIPT,
			'var graphDrawThemeAliases = ' . wp_json_encode( $aliases ) . ';',
			'before'
		);
	}
}
