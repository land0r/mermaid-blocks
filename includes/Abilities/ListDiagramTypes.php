<?php
/**
 * The `mermaid-blocks/list-diagram-types` ability.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use MermaidBlocks\DiagramTypes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lists the diagram types the plugin has starter code for: the same as the
 * block's variations.
 */
final class ListDiagramTypes extends Ability {

	/**
	 * The diagram types.
	 *
	 * @var DiagramTypes
	 */
	private DiagramTypes $types;

	/**
	 * Sets up the ability.
	 *
	 * @param DiagramTypes $types The diagram types.
	 */
	public function __construct( DiagramTypes $types ) {
		$this->types = $types;
	}

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'mermaid-blocks/list-diagram-types';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'List diagram types', 'mermaid-blocks' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Lists the types of Mermaid diagram with starter code, and the code. A diagram can be of any other type Mermaid supports too.', 'mermaid-blocks' );
	}

	/**
	 * Returns the schema of the output.
	 *
	 * @return array The schema.
	 */
	protected function get_output_schema(): array {
		return array(
			'type'  => 'array',
			'items' => array(
				'type'       => 'object',
				'properties' => array(
					'name'        => array(
						'type'        => 'string',
						'description' => __( 'The name of the type.', 'mermaid-blocks' ),
					),
					'title'       => array( 'type' => 'string' ),
					'description' => array( 'type' => 'string' ),
					'keyword'     => array(
						'type'        => 'string',
						'description' => __( 'The keyword the code of a diagram of this type starts with.', 'mermaid-blocks' ),
					),
					'code'        => array(
						'type'        => 'string',
						'description' => __( 'Starter code for a diagram of this type.', 'mermaid-blocks' ),
					),
				),
			),
		);
	}

	/**
	 * Tells whether the ability changes nothing.
	 *
	 * @return bool True.
	 */
	protected function is_readonly(): bool {
		return true;
	}

	/**
	 * Tells whether running the ability again changes nothing more.
	 *
	 * @return bool True.
	 */
	protected function is_idempotent(): bool {
		return true;
	}

	/**
	 * Tells whether the current user may list the types: whether they may
	 * write posts.
	 *
	 * @param mixed $input Unused: the ability takes no input.
	 *
	 * @return bool Whether the user may run the ability.
	 */
	public function check_permissions( $input = null ) {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Lists the types.
	 *
	 * @param mixed $input Unused: the ability takes no input.
	 *
	 * @return array[] The types.
	 */
	public function execute( $input = null ) {
		$types = array();

		foreach ( $this->types->get_all() as $name => $type ) {
			$types[] = array(
				'name'        => $name,
				'title'       => $type['title'],
				'description' => $type['description'],
				'keyword'     => $type['keyword'],
				'code'        => $type['code'],
			);
		}

		return $types;
	}
}
