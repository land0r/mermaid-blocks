<?php
/**
 * The `mermaid-blocks/get-diagram` ability.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Returns one diagram of a post, by its index.
 */
final class GetDiagram extends PostAbility {

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
				'post_id' => $this->schemas->get_post_id(),
				'index'   => $this->schemas->get_index(),
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
		return $this->schemas->get_diagram();
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
	 * @param WP_Post $post  The post.
	 * @param array   $input The input, with the index.
	 *
	 * @return array|\WP_Error The diagram, or the error.
	 */
	protected function run( WP_Post $post, array $input ) {
		return $this->describe_saved( $post->ID, (int) $input['index'] );
	}
}
