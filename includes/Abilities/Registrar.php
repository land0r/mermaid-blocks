<?php
/**
 * Registers the plugin's abilities.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Abilities;

use GraphDraw\Container;
use GraphDraw\Hookable;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the abilities, and their category, with the WordPress Abilities
 * API, in WordPress 6.9 and later. Older versions never fire its hooks.
 *
 * The abilities are created when WordPress asks for them, and not before:
 * most requests never do. That is why this class has the container, and
 * creates them by name.
 */
final class Registrar implements Hookable {

	/**
	 * The slug of the abilities' category.
	 */
	const CATEGORY = 'graphdraw';

	/**
	 * The classes of the abilities, in the order they are registered. A new
	 * ability is a class extending Ability, and a line here.
	 */
	const ABILITIES = array(
		ListDiagramTypes::class,
		ListDiagrams::class,
		GetDiagram::class,
		BuildBlockMarkup::class,
		InsertDiagram::class,
		UpdateDiagram::class,
		DeleteDiagram::class,
	);

	/**
	 * The container, which creates the abilities.
	 *
	 * @var Container
	 */
	private Container $container;

	/**
	 * Sets up the registrar.
	 *
	 * @param Container $container The container, which creates the abilities.
	 */
	public function __construct( Container $container ) {
		$this->container = $container;
	}

	/**
	 * Registers the category and the abilities when WordPress asks for them.
	 */
	public function hooks(): void {
		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}

	/**
	 * Returns the abilities.
	 *
	 * @return Ability[] The abilities, by name.
	 */
	public function get_abilities(): array {
		$abilities = array();

		foreach ( self::ABILITIES as $class ) {
			$ability = $this->container->get( $class );

			$abilities[ $ability->get_name() ] = $ability;
		}

		return $abilities;
	}

	/**
	 * Registers the category of the abilities.
	 */
	public function register_category(): void {
		// The action fires only on WordPress 6.9+, which has the function: the check is for Plugin Check.
		if ( function_exists( 'wp_register_ability_category' ) ) {
			wp_register_ability_category( self::CATEGORY, $this->get_category_args() );
		}
	}

	/**
	 * Registers the abilities.
	 */
	public function register_abilities(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		foreach ( $this->get_abilities() as $name => $ability ) {
			wp_register_ability( $name, $ability->get_args( self::CATEGORY ) );
		}
	}

	/**
	 * Returns the label and the description of the category.
	 *
	 * @return array The arguments of wp_register_ability_category().
	 */
	public function get_category_args(): array {
		return array(
			'label'       => __( 'Mermaid diagrams', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'description' => __( 'Read, create, change and delete the Mermaid diagrams in posts.', 'graphdraw-mermaid-diagrams-flowcharts' ),
		);
	}
}
