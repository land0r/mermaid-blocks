<?php
/**
 * The `mermaid-blocks/insert-diagram` ability.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adds a diagram to a post.
 */
final class InsertDiagram extends DiagramAbility {

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'mermaid-blocks/insert-diagram';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'Insert a diagram', 'mermaid-blocks' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Adds a Mermaid diagram block to a post, at the end or before one of its top-level blocks. The post is saved, with a revision.', 'mermaid-blocks' );
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
				'post_id'    => $this->get_post_id_schema(),
				'code'       => $this->get_code_schema(),
				'attributes' => $this->get_attributes_schema(),
				'position'   => array(
					'type'        => 'integer',
					'minimum'     => 0,
					'description' => __( 'The position among the top-level blocks of the post to add the diagram at, counting from 0. Without one, or past the last block, the diagram goes at the end.', 'mermaid-blocks' ),
				),
			),
			'required'             => array( 'post_id', 'code' ),
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
	 * Adds the diagram.
	 *
	 * @param mixed $input The post, the code, the other attributes, and the
	 *                     position.
	 *
	 * @return array|\WP_Error The new diagram, or the error.
	 */
	public function execute( $input = null ) {
		$input = (array) $input;
		$post  = $this->get_post( $input );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$code = $this->get_code( $input );

		if ( is_wp_error( $code ) ) {
			return $code;
		}

		$attributes = isset( $input['attributes'] ) ? (array) $input['attributes'] : array();
		$position   = isset( $input['position'] ) ? absint( $input['position'] ) : null;
		$index      = $this->diagrams->insert( $post, $this->diagrams->create_block( $code, $attributes ), $position );

		if ( is_wp_error( $index ) ) {
			return $index;
		}

		return $this->describe_saved( $post->ID, $index );
	}
}
