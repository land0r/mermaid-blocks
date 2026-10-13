<?php
/**
 * The schemas the abilities share.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use MermaidBlocks\Posts\PostDiagrams;
use MermaidBlocks\Themes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The parts of a schema that more than one ability has: what addresses a
 * diagram in the input, its code and attributes, and a diagram in the output.
 */
final class Schemas {

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * Sets up the schemas.
	 *
	 * @param Themes $themes The themes a diagram can be drawn in.
	 */
	public function __construct( Themes $themes ) {
		$this->themes = $themes;
	}

	/**
	 * Returns the schema of a post ID in the input.
	 *
	 * @return array The schema.
	 */
	public function get_post_id(): array {
		return array(
			'type'        => 'integer',
			'minimum'     => 1,
			'description' => __( 'The ID of the post.', 'mermaid-blocks' ),
		);
	}

	/**
	 * Returns the schema of a diagram's index in the input.
	 *
	 * @return array The schema.
	 */
	public function get_index(): array {
		return array(
			'type'        => 'integer',
			'minimum'     => 0,
			'description' => __( 'The index of the diagram: its position among the diagrams of the post, in document order, nested blocks included, counting from 0.', 'mermaid-blocks' ),
		);
	}

	/**
	 * Returns the schema of a diagram's hash in the input.
	 *
	 * @return array The schema.
	 */
	public function get_hash(): array {
		return array(
			'type'        => 'string',
			'pattern'     => '^[0-9a-f]{32}$',
			'description' => __( 'The hash of the diagram, as the last read of it returned. The change fails when the diagram changed since then.', 'mermaid-blocks' ),
		);
	}

	/**
	 * Returns the schema of Mermaid source in the input.
	 *
	 * @return array The schema.
	 */
	public function get_code(): array {
		return array(
			'type'        => 'string',
			'minLength'   => 1,
			'description' => __( 'The Mermaid source of the diagram. It is not validated: use the mermaid-blocks/validate-diagram ability in the block editor for that.', 'mermaid-blocks' ),
		);
	}

	/**
	 * Returns the schema of the attributes of a diagram, other than its code,
	 * in the input: each attribute of PostDiagrams::ATTRIBUTES, with its type
	 * from there.
	 *
	 * @return array The schema.
	 */
	public function get_attributes(): array {
		$details    = $this->get_attribute_details();
		$properties = array();

		foreach ( PostDiagrams::ATTRIBUTES as $name => $type ) {
			$properties[ $name ] = array( 'type' => $type ) + ( isset( $details[ $name ] ) ? $details[ $name ] : array() );
		}

		return array(
			'type'                 => 'object',
			'description'          => __( 'Attributes of the diagram block besides its code. An empty string or false removes an attribute.', 'mermaid-blocks' ),
			'properties'           => $properties,
			'additionalProperties' => false,
		);
	}

	/**
	 * Returns the schema of a diagram in the output, as
	 * PostDiagrams::describe() returns it.
	 *
	 * @return array The schema.
	 */
	public function get_diagram(): array {
		return array(
			'type'       => 'object',
			'properties' => array(
				'post_id'    => array(
					'type'        => 'integer',
					'description' => __( 'The ID of the post the diagram is in.', 'mermaid-blocks' ),
				),
				'index'      => array(
					'type'        => 'integer',
					'description' => __( 'The index of the diagram in the post, counting from 0.', 'mermaid-blocks' ),
				),
				'hash'       => array(
					'type'        => 'string',
					'description' => __( 'The hash of the diagram. Pass it to change or delete the diagram.', 'mermaid-blocks' ),
				),
				'code'       => array(
					'type'        => 'string',
					'description' => __( 'The Mermaid source.', 'mermaid-blocks' ),
				),
				'type'       => array(
					'type'        => 'string',
					'description' => __( 'The keyword the source starts with, such as flowchart or sequenceDiagram. Empty when there is none.', 'mermaid-blocks' ),
				),
				'validated'  => array(
					'type'        => 'boolean',
					'description' => __( 'Always false: the server cannot parse Mermaid.', 'mermaid-blocks' ),
				),
				'attributes' => array(
					'type'        => 'object',
					'description' => __( 'The other attributes of the diagram block.', 'mermaid-blocks' ),
				),
			),
		);
	}

	/**
	 * Returns what the schema says about each attribute besides its type: what
	 * it is, and the values it takes.
	 *
	 * @return array[] The description of each attribute of
	 *                 PostDiagrams::ATTRIBUTES, and its `enum` where it has
	 *                 one, by name.
	 */
	private function get_attribute_details(): array {
		return array(
			'theme'      => array(
				'enum'        => array_merge( array( '' ), array_keys( $this->themes->get_all() ) ),
				'description' => __( 'The theme of the diagram. Without one, the theme set for the site.', 'mermaid-blocks' ),
			),
			'caption'    => array(
				'description' => __( 'A caption shown under the diagram. It may hold the HTML allowed in posts.', 'mermaid-blocks' ),
			),
			'zoom'       => array(
				'description' => __( 'Whether visitors get zoom controls.', 'mermaid-blocks' ),
			),
			'download'   => array(
				'description' => __( 'Whether visitors get buttons that download the diagram as an SVG or PNG file.', 'mermaid-blocks' ),
			),
			'copy'       => array(
				'description' => __( 'Whether visitors get a button that copies the code of the diagram.', 'mermaid-blocks' ),
			),
			'fullscreen' => array(
				'description' => __( 'Whether visitors get a button that shows the diagram over the whole screen.', 'mermaid-blocks' ),
			),
			'accTitle'   => array(
				'description' => __( 'A title of the diagram for screen readers.', 'mermaid-blocks' ),
			),
			'accDescr'   => array(
				'description' => __( 'A description of the diagram for screen readers.', 'mermaid-blocks' ),
			),
			'align'      => array(
				'enum'        => array( '', 'center', 'wide', 'full' ),
				'description' => __( 'The alignment of the diagram.', 'mermaid-blocks' ),
			),
		);
	}
}
