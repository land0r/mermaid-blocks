<?php
/**
 * The `mermaid-blocks/get-diagram` ability.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Returns one diagram of a post, by its index.
 */
final class GetDiagram extends DiagramAbility {

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'mermaid-blocks/get-diagram';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'Get a diagram', 'mermaid-blocks' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Returns one Mermaid diagram of a post: its code, its attributes, and the hash to pass when changing it.', 'mermaid-blocks' );
	}

	/**
	 * Returns the schema of the input.
	 *
	 * @return array The schema.
	 */
	protected function get_input_schema(): array {
		return array(
			'type'                 => 'object',
			'properties'           => array(
				'post_id' => $this->get_post_id_schema(),
				'index'   => $this->get_index_schema(),
			),
			'required'             => array( 'post_id', 'index' ),
			'additionalProperties' => false,
		);
	}

	/**
	 * Returns the schema of the output.
	 *
	 * @return array The schema.
	 */
	protected function get_output_schema(): array {
		return $this->get_diagram_schema();
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
	 * Returns the diagram.
	 *
	 * @param mixed $input The post and the index.
	 *
	 * @return array|\WP_Error The diagram, or the error.
	 */
	public function execute( $input = null ) {
		$post = $this->get_post( $input );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		return $this->describe_saved( $post->ID, (int) $input['index'] );
	}
}
