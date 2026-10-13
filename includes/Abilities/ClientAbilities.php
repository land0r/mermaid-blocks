<?php
/**
 * The abilities that run in the browser.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use MermaidBlocks\Files;
use MermaidBlocks\Hookable;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loads the abilities that run in the browser, in the block editor:
 * `mermaid-blocks/validate-diagram` parses a diagram with the editor's copy
 * of Mermaid, which the server can't. They are a script module, built from
 * `src/abilities/`, and need the client-side Abilities API of WordPress 7.0.
 */
final class ClientAbilities implements Hookable {

	/**
	 * The script module that registers the abilities.
	 */
	const MODULE = 'mermaid-blocks/abilities';

	/**
	 * The plugin's files, to find the module.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * What registers the abilities of the server, which has their category.
	 *
	 * @var Registrar
	 */
	private Registrar $registrar;

	/**
	 * Sets up the abilities.
	 *
	 * @param Files     $files     The plugin's files.
	 * @param Registrar $registrar What registers the abilities of the server.
	 */
	public function __construct( Files $files, Registrar $registrar ) {
		$this->files     = $files;
		$this->registrar = $registrar;
	}

	/**
	 * Loads the module in the block editor, with its texts.
	 */
	public function hooks(): void {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue' ) );
		add_filter( 'script_module_data_' . self::MODULE, array( $this, 'add_data' ) );
	}

	/**
	 * Loads the abilities, where WordPress has the client-side Abilities API.
	 */
	public function enqueue(): void {
		$modules = wp_script_modules();

		if ( ! method_exists( $modules, 'get_registered' ) || ! $modules->get_registered( '@wordpress/core-abilities' ) ) {
			return;
		}

		$asset = $this->files->get_build_asset( 'abilities' );

		wp_enqueue_script_module(
			self::MODULE,
			$this->files->get_build_url( 'abilities.js' ),
			$asset['dependencies'],
			$asset['version']
		);
	}

	/**
	 * Passes the module the texts it needs, translated: the module has no
	 * access to translations of its own.
	 *
	 * @param array $data The data of the module.
	 *
	 * @return array The data, with the category and the abilities' texts.
	 */
	public function add_data( $data ): array {
		return array_merge(
			(array) $data,
			array(
				'category'  => array( 'slug' => Registrar::CATEGORY ) + $this->registrar->get_category_args(),
				'abilities' => array(
					'validateDiagram' => array(
						'label'       => __( 'Validate a diagram', 'mermaid-blocks' ),
						'description' => __( 'Parses Mermaid source with the Mermaid library of the editor, and tells whether it is a valid diagram: its type, or the error and the line it is on. Changes nothing.', 'mermaid-blocks' ),
					),
				),
			)
		);
	}
}
