<?php
/**
 * The base of the abilities that work on diagrams.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Abilities;

use GraphDraw\Posts\PostDiagrams;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * An ability that works on diagrams, in posts or on their own. It has what
 * reads and writes the diagram blocks, and the schemas the abilities share,
 * and reads the post and the code an input names.
 *
 * An ability that works on one diagram of one post extends PostAbility.
 */
abstract class DiagramAbility extends Ability {

	/**
	 * The diagrams in posts.
	 *
	 * @var PostDiagrams
	 */
	protected PostDiagrams $diagrams;

	/**
	 * The schemas the abilities share.
	 *
	 * @var Schemas
	 */
	protected Schemas $schemas;

	/**
	 * Sets up the ability.
	 *
	 * @param PostDiagrams $diagrams The diagrams in posts.
	 * @param Schemas      $schemas  The schemas the abilities share.
	 */
	public function __construct( PostDiagrams $diagrams, Schemas $schemas ) {
		$this->diagrams = $diagrams;
		$this->schemas  = $schemas;
	}

	/**
	 * Returns the ID of the post an input names.
	 *
	 * @param mixed $input The input.
	 *
	 * @return int The ID, or 0 when there is none.
	 */
	protected function get_post_id( $input ): int {
		return is_array( $input ) && isset( $input['post_id'] ) ? absint( $input['post_id'] ) : 0;
	}

	/**
	 * Returns the Mermaid source in an input, if it has any.
	 *
	 * @param array $input The input, with a `code`.
	 *
	 * @return string|WP_Error The source, or the error for one that is blank.
	 */
	protected function get_code( array $input ) {
		$code = isset( $input['code'] ) ? (string) $input['code'] : '';

		if ( '' === trim( $code ) ) {
			return $this->error( 'graphdraw_empty_code', __( 'The code of a diagram cannot be blank.', 'graphdraw-mermaid-diagrams-flowcharts' ) );
		}

		return $code;
	}
}
