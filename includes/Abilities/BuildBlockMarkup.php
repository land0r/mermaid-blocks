<?php
/**
 * The `graphdraw/build-block-markup` ability.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Turns Mermaid source into the serialized markup of a diagram block, for
 * abilities of other plugins that write whole posts.
 */
final class BuildBlockMarkup extends DiagramAbility {

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'graphdraw/build-block-markup';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'Build diagram block markup', 'graphdraw-mermaid-diagrams-flowcharts' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Returns the block markup of a Mermaid diagram, to put in the content of a post written by other means. Saves nothing.', 'graphdraw-mermaid-diagrams-flowcharts' );
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
				'code'       => $this->schemas->get_code(),
				'attributes' => $this->schemas->get_attributes(),
			),
			'required'             => array( 'code' ),
			'additionalProperties' => false,
		);
	}

	/**
	 * Returns the schema of the output.
	 *
	 * @return array The schema.
	 */
	protected function get_output_schema(): array {
		$diagram = $this->schemas->get_diagram()['properties'];

		return array(
			'type'       => 'object',
			'properties' => array(
				'markup'    => array(
					'type'        => 'string',
					'description' => __( 'The block markup.', 'graphdraw-mermaid-diagrams-flowcharts' ),
				),
				'type'      => $diagram['type'],
				'validated' => $diagram['validated'],
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
	 * Tells whether the current user may build the markup: whether they may
	 * write posts.
	 *
	 * @param mixed $input The input.
	 *
	 * @return bool Whether the user may run the ability.
	 */
	public function check_permissions( $input = null ) {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Builds the markup.
	 *
	 * @param mixed $input The code, and other attributes.
	 *
	 * @return array|\WP_Error The markup, and the detected type, or the error.
	 */
	public function execute( $input = null ) {
		$input = (array) $input;
		$code  = $this->get_code( $input );

		if ( is_wp_error( $code ) ) {
			return $code;
		}

		$attributes = isset( $input['attributes'] ) ? (array) $input['attributes'] : array();
		$block      = $this->diagrams->create_block( $code, $attributes );

		return array(
			'markup'    => serialize_block( $block ),
			'type'      => $this->diagrams->get_type( $block ),
			'validated' => false,
		);
	}
}
