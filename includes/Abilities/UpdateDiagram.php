<?php
/**
 * The `graphdraw/update-diagram` ability.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Abilities;

use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Changes the code or the other attributes of a diagram in a post.
 */
final class UpdateDiagram extends PostAbility {

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'graphdraw/update-diagram';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'Update a diagram', 'graphdraw-mermaid-diagrams-flowcharts' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Changes the code or the attributes of a Mermaid diagram in a post. Attributes left out stay as they are. It fails when the diagram changed since it was read, as its hash tells. The post is saved, with a revision.', 'graphdraw-mermaid-diagrams-flowcharts' );
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
				'post_id'    => $this->schemas->get_post_id(),
				'index'      => $this->schemas->get_index(),
				'hash'       => $this->schemas->get_hash(),
				'code'       => $this->schemas->get_code(),
				'attributes' => $this->schemas->get_attributes(),
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
		return $this->schemas->get_diagram();
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
	 * Changes the diagram.
	 *
	 * @param WP_Post $post  The post.
	 * @param array   $input The input, with the index, the hash, and the
	 *                       changes.
	 *
	 * @return array|\WP_Error The changed diagram, or the error.
	 */
	protected function run( WP_Post $post, array $input ) {
		if ( ! isset( $input['code'] ) && empty( $input['attributes'] ) ) {
			return $this->error( 'graphdraw_nothing_to_update', __( 'Give the diagram new code, or attributes to change.', 'graphdraw-mermaid-diagrams-flowcharts' ) );
		}

		$index = (int) $input['index'];
		$block = $this->diagrams->get( $post, $index );

		if ( null === $block ) {
			return $this->diagrams->get_not_found_error( $index );
		}

		$attributes = isset( $input['attributes'] ) ? (array) $input['attributes'] : array();

		$block['attrs'] = $this->diagrams->merge_attributes( (array) $block['attrs'], $attributes );

		if ( isset( $input['code'] ) ) {
			$code = $this->get_code( $input );

			if ( is_wp_error( $code ) ) {
				return $code;
			}

			$block['attrs']['code'] = $code;
		}

		$result = $this->diagrams->replace( $post, $index, (string) $input['hash'], $block );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->describe_saved( $post->ID, $index );
	}
}
