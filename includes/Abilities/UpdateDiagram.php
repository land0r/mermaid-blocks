<?php
/**
 * The `mermaid-blocks/update-diagram` ability.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Changes the code or the other attributes of a diagram in a post.
 */
final class UpdateDiagram extends DiagramAbility {

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'mermaid-blocks/update-diagram';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'Update a diagram', 'mermaid-blocks' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Changes the code or the attributes of a Mermaid diagram in a post. Attributes left out stay as they are. It fails when the diagram changed since it was read, as its hash tells. The post is saved, with a revision.', 'mermaid-blocks' );
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
				'index'      => $this->get_index_schema(),
				'hash'       => $this->get_hash_schema(),
				'code'       => $this->get_code_schema(),
				'attributes' => $this->get_attributes_schema(),
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
		return $this->get_diagram_schema();
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
	 * @param mixed $input The post, the index, the hash, and the changes.
	 *
	 * @return array|\WP_Error The changed diagram, or the error.
	 */
	public function execute( $input = null ) {
		$input = (array) $input;
		$post  = $this->get_post( $input );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! isset( $input['code'] ) && empty( $input['attributes'] ) ) {
			return $this->error( 'mermaid_blocks_nothing_to_update', __( 'Give the diagram new code, or attributes to change.', 'mermaid-blocks' ) );
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
