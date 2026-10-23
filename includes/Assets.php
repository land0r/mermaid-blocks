<?php
/**
 * The scripts and styles of diagrams, from `build/`.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the Mermaid library, and the script and style that turn diagram
 * markup into SVGs.
 *
 * - `mermaid-js`: the Mermaid library, for the editor.
 * - `mermaid-blocks-diagram` (script): renders each diagram on the page when
 *   it scrolls into view, and adds its controls. It loads Mermaid's ES module
 *   build from `build/mermaid/` on demand, so Mermaid isn't one of its
 *   dependencies.
 * - `mermaid-blocks-diagram` (style): hides the source until it renders, and
 *   styles the controls.
 */
final class Assets implements Hookable {

	/**
	 * The handle of the Mermaid library.
	 */
	const MERMAID = 'mermaid-js';

	/**
	 * The handle of the script, and of the style, that render diagrams.
	 */
	const DIAGRAM = 'mermaid-blocks-diagram';

	/**
	 * The plugin's files, to find those of the build.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * Sets up the assets.
	 *
	 * @param Files $files The plugin's files.
	 */
	public function __construct( Files $files ) {
		$this->files = $files;
	}

	/**
	 * Registers the assets with WordPress.
	 */
	public function hooks(): void {
		// Before the block, which refers to them by handle, at the default priority.
		add_action( 'init', array( $this, 'register' ), 9 );
	}

	/**
	 * Registers the Mermaid library, and the script and style that render
	 * diagrams.
	 */
	public function register(): void {
		$mermaid = $this->files->get_build_asset( 'mermaid' );
		wp_register_script(
			self::MERMAID,
			$this->files->get_build_url( 'mermaid.min.js' ),
			array(),
			$mermaid['version'],
			true
		);

		$view = $this->files->get_build_asset( 'view' );
		wp_register_script(
			self::DIAGRAM,
			$this->files->get_build_url( 'view.js' ),
			$view['dependencies'],
			$view['version'],
			true
		);

		// The script has no dependencies, so its few labels are translated here.
		$controls = $this->files->get_build_asset( 'controls' );
		$settings = array(
			'mermaidUrl'  => add_query_arg( 'ver', $mermaid['version'], $this->files->get_build_url( 'mermaid/mermaid.esm.min.js' ) ),
			'controlsUrl' => add_query_arg( 'ver', $controls['version'], $this->files->get_build_url( 'controls.js' ) ),
			'i18n'        => array(
				'controls'       => __( 'Diagram controls', 'mermaid-blocks' ),
				'zoomIn'         => __( 'Zoom in', 'mermaid-blocks' ),
				'zoomOut'        => __( 'Zoom out', 'mermaid-blocks' ),
				'resetZoom'      => __( 'Reset zoom', 'mermaid-blocks' ),
				'downloadSvg'    => __( 'Download as SVG', 'mermaid-blocks' ),
				'downloadPng'    => __( 'Download as PNG', 'mermaid-blocks' ),
				'downloadError'  => __( 'The file could not be created.', 'mermaid-blocks' ),
				'copyCode'       => __( 'Copy code', 'mermaid-blocks' ),
				'copied'         => __( 'Copied.', 'mermaid-blocks' ),
				'copyError'      => __( 'The code could not be copied.', 'mermaid-blocks' ),
				'fullscreen'     => __( 'View fullscreen', 'mermaid-blocks' ),
				'exitFullscreen' => __( 'Exit fullscreen', 'mermaid-blocks' ),
			),
		);
		wp_add_inline_script(
			self::DIAGRAM,
			'var mermaidBlocksSettings = ' . wp_json_encode( $settings ) . ';',
			'before'
		);

		$style_file = $this->files->get_build_path( 'style-index.css' );
		wp_register_style(
			self::DIAGRAM,
			$this->files->get_build_url( 'style-index.css' ),
			array(),
			file_exists( $style_file ) ? (string) filemtime( $style_file ) : false
		);

		// Same handling WordPress gives stylesheets declared as files in block.json.
		$rtl_style_file = $this->files->get_build_path( 'style-index-rtl.css' );
		if ( is_rtl() && file_exists( $rtl_style_file ) ) {
			wp_style_add_data( self::DIAGRAM, 'rtl', 'replace' );
			wp_style_add_data( self::DIAGRAM, 'path', $rtl_style_file );
		} else {
			wp_style_add_data( self::DIAGRAM, 'path', $style_file );
		}
	}

	/**
	 * Enqueues the script and style that render diagrams on the page.
	 */
	public function enqueue_diagram(): void {
		wp_enqueue_script( self::DIAGRAM );
		wp_enqueue_style( self::DIAGRAM );
	}
}
