<?php
/**
 * Registers the plugin's abilities.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use MermaidBlocks\Assets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the abilities it is given, and their category, with the
 * WordPress Abilities API, in WordPress 6.9 and later. Older versions never
 * fire its hooks.
 *
 * It also loads the abilities that run in the browser, in the block editor:
 * `mermaid-blocks/validate-diagram` parses a diagram with the editor's copy
 * of Mermaid, which the server can't. They need the client-side Abilities
 * API of WordPress 7.0.
 */
final class AbilitiesRegistrar {

	/**
	 * The slug of the abilities' category.
	 */
	const CATEGORY = 'mermaid-blocks';

	/**
	 * The script module that registers the abilities that run in the browser.
	 */
	const CLIENT_MODULE = 'mermaid-blocks/abilities';

	/**
	 * The abilities, by name.
	 *
	 * @var Ability[]
	 */
	private array $abilities = array();

	/**
	 * The scripts and styles of diagrams, to find the client module.
	 *
	 * @var Assets
	 */
	private Assets $assets;

	/**
	 * Sets up the registrar.
	 *
	 * @param Assets  $assets       The scripts and styles of diagrams.
	 * @param Ability ...$abilities The abilities to register.
	 */
	public function __construct( Assets $assets, Ability ...$abilities ) {
		$this->assets = $assets;

		foreach ( $abilities as $ability ) {
			$this->abilities[ $ability->get_name() ] = $ability;
		}
	}

	/**
	 * Registers the category and the abilities when WordPress asks for them.
	 */
	public function hooks(): void {
		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_client_abilities' ) );
		add_filter( 'script_module_data_' . self::CLIENT_MODULE, array( $this, 'add_client_data' ) );
	}

	/**
	 * Returns the abilities.
	 *
	 * @return Ability[] The abilities, by name.
	 */
	public function get_abilities(): array {
		return $this->abilities;
	}

	/**
	 * Registers the category of the abilities.
	 */
	public function register_category(): void {
		wp_register_ability_category( self::CATEGORY, $this->get_category_args() );
	}

	/**
	 * Registers the abilities.
	 */
	public function register_abilities(): void {
		foreach ( $this->abilities as $name => $ability ) {
			wp_register_ability( $name, $ability->get_args( self::CATEGORY ) );
		}
	}

	/**
	 * Loads the abilities that run in the browser, where WordPress has the
	 * client-side Abilities API.
	 */
	public function enqueue_client_abilities(): void {
		$modules = wp_script_modules();

		if ( ! method_exists( $modules, 'get_registered' ) || ! $modules->get_registered( '@wordpress/core-abilities' ) ) {
			return;
		}

		$asset = $this->assets->get_build_asset( 'abilities' );

		wp_enqueue_script_module(
			self::CLIENT_MODULE,
			$this->assets->get_url( 'abilities.js' ),
			$asset['dependencies'],
			$asset['version']
		);
	}

	/**
	 * Passes the client module the texts it needs, translated: the module
	 * has no access to translations of its own.
	 *
	 * @param array $data The data of the module.
	 *
	 * @return array The data, with the category and the abilities' texts.
	 */
	public function add_client_data( $data ): array {
		return array_merge(
			(array) $data,
			array(
				'category'  => array( 'slug' => self::CATEGORY ) + $this->get_category_args(),
				'abilities' => array(
					'validateDiagram' => array(
						'label'       => __( 'Validate a diagram', 'mermaid-blocks' ),
						'description' => __( 'Parses Mermaid source with the Mermaid library of the editor, and tells whether it is a valid diagram: its type, or the error and the line it is on. Changes nothing.', 'mermaid-blocks' ),
					),
				),
			)
		);
	}

	/**
	 * Returns the label and the description of the category.
	 *
	 * @return array The arguments of wp_register_ability_category().
	 */
	private function get_category_args(): array {
		return array(
			'label'       => __( 'Mermaid diagrams', 'mermaid-blocks' ),
			'description' => __( 'Read, create, change and delete the Mermaid diagrams in posts.', 'mermaid-blocks' ),
		);
	}
}
