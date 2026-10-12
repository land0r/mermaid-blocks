<?php
/**
 * The `mermaid-blocks/delete-diagram` ability.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Removes a diagram from a post.
 */
final class DeleteDiagram extends DiagramAbility {

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'mermaid-blocks/delete-diagram';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'Delete a diagram', 'mermaid-blocks' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Removes a Mermaid diagram block from a post. It fails when the diagram changed since it was read, as its hash tells. The post is saved, with a revision to restore it from.', 'mermaid-blocks' );
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
				'hash'    => $this->get_hash_schema(),
			),
			'required'             => array( 'post_id', 'index', 'hash' ),
			'additionalProperties' => false,
		);
	}

	/**
	 * Returns the schema of the output.
	 *
	 * @return array The schema.
	 */
	protected function get_output_schema(): array {
		return array(
			'type'       => 'object',
			'properties' => array(
				'post_id' => array( 'type' => 'integer' ),
				'index'   => array( 'type' => 'integer' ),
				'deleted' => array( 'type' => 'boolean' ),
			),
		);
	}

	/**
	 * Tells whether the ability may remove something.
	 *
	 * @return bool True.
	 */
	protected function is_destructive(): bool {
		return true;
	}

	/**
	 * Tells whether running the ability again changes nothing more: the hash
	 * no longer matches after the first run.
	 *
	 * @return bool True.
	 */
	protected function is_idempotent(): bool {
		return true;
	}

	/**
	 * Removes the diagram.
	 *
	 * @param mixed $input The post, the index and the hash.
	 *
	 * @return array|\WP_Error What was removed, or the error.
	 */
	public function execute( $input = null ) {
		$input = (array) $input;
		$post  = $this->get_post( $input );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$index  = (int) $input['index'];
		$result = $this->diagrams->remove( $post, $index, (string) $input['hash'] );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return array(
			'post_id' => $post->ID,
			'index'   => $index,
			'deleted' => true,
		);
	}
}
