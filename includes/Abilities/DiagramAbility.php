<?php
/**
 * The base of the abilities that work on diagrams.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use MermaidBlocks\PostDiagrams;
use MermaidBlocks\Themes;
use WP_Error;
use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * An ability that works on diagrams, in posts or on their own. It shares the
 * schemas of a diagram and of its input, and finds the post an input names.
 *
 * Its permissions are the block editor's: a user works with the diagrams of
 * the posts they may edit (`edit_post`), and with none of the others. So
 * contributors reach their own drafts, authors their own posts, and editors
 * and administrators every post, while subscribers and visitors reach none.
 * Reading a diagram needs the same, since it gives the source, as editing the
 * post would. Sites can narrow this with the `wp_ability_permission_result`
 * filter of WordPress 7.1.
 */
abstract class DiagramAbility extends Ability {

	/**
	 * The diagrams in posts.
	 *
	 * @var PostDiagrams
	 */
	protected PostDiagrams $diagrams;

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	protected Themes $themes;

	/**
	 * Sets up the ability.
	 *
	 * @param PostDiagrams $diagrams The diagrams in posts.
	 * @param Themes       $themes   The themes a diagram can be drawn in.
	 */
	public function __construct( PostDiagrams $diagrams, Themes $themes ) {
		$this->diagrams = $diagrams;
		$this->themes   = $themes;
	}

	/**
	 * Tells whether the current user may edit the post the input names.
	 *
	 * For a post that doesn't exist, whether they may edit posts at all:
	 * execute() then says it doesn't exist.
	 *
	 * @param mixed $input The input, with a `post_id`.
	 *
	 * @return bool Whether the user may run the ability.
	 */
	public function check_permissions( $input = null ) {
		$post = get_post( $this->get_post_id( $input ) );

		if ( ! $post ) {
			return current_user_can( 'edit_posts' );
		}

		return current_user_can( 'edit_post', $post->ID );
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
	 * Returns the post an input names, if diagrams can be in it: a post of a
	 * type edited in the block editor, not in the trash.
	 *
	 * @param mixed $input The input, with a `post_id`.
	 *
	 * @return WP_Post|WP_Error The post, or the error.
	 */
	protected function get_post( $input ) {
		$post = get_post( $this->get_post_id( $input ) );

		if ( ! $post ) {
			return $this->error( 'mermaid_blocks_post_not_found', __( 'There is no post with this ID.', 'mermaid-blocks' ), 404 );
		}

		if ( ! in_array( $post->post_type, $this->get_post_types(), true ) ) {
			return $this->error( 'mermaid_blocks_invalid_post_type', __( 'Posts of this type are not edited in the block editor, so they hold no diagrams.', 'mermaid-blocks' ) );
		}

		// As in the editor, which doesn't open posts in the trash.
		if ( 'trash' === $post->post_status ) {
			return $this->error( 'mermaid_blocks_post_in_trash', __( 'The post is in the trash. Restore it first.', 'mermaid-blocks' ), 410 );
		}

		return $post;
	}

	/**
	 * Returns the post types diagrams can be in: those edited in the block
	 * editor.
	 *
	 * @return string[] The names of the post types.
	 */
	protected function get_post_types(): array {
		$types = array();

		foreach ( get_post_types( array( 'show_in_rest' => true ), 'names' ) as $type ) {
			if ( 'attachment' !== $type && post_type_supports( $type, 'editor' ) ) {
				$types[] = $type;
			}
		}

		return $types;
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
			return $this->error( 'mermaid_blocks_empty_code', __( 'The code of a diagram cannot be blank.', 'mermaid-blocks' ) );
		}

		return $code;
	}

	/**
	 * Returns the schema of a post ID in the input.
	 *
	 * @return array The schema.
	 */
	protected function get_post_id_schema(): array {
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
	protected function get_index_schema(): array {
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
	protected function get_hash_schema(): array {
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
	protected function get_code_schema(): array {
		return array(
			'type'        => 'string',
			'minLength'   => 1,
			'description' => __( 'The Mermaid source of the diagram. It is not validated: use the mermaid-blocks/validate-diagram ability in the block editor for that.', 'mermaid-blocks' ),
		);
	}

	/**
	 * Returns the schema of the attributes of a diagram, other than its code,
	 * in the input.
	 *
	 * @return array The schema.
	 */
	protected function get_attributes_schema(): array {
		return array(
			'type'                 => 'object',
			'description'          => __( 'Attributes of the diagram block besides its code. An empty string or false removes an attribute.', 'mermaid-blocks' ),
			'properties'           => array(
				'theme'      => array(
					'type'        => 'string',
					'enum'        => array_merge( array( '' ), array_keys( $this->themes->get_all() ) ),
					'description' => __( 'The theme of the diagram. Without one, the theme set for the site.', 'mermaid-blocks' ),
				),
				'caption'    => array(
					'type'        => 'string',
					'description' => __( 'A caption shown under the diagram. It may hold the HTML allowed in posts.', 'mermaid-blocks' ),
				),
				'zoom'       => array(
					'type'        => 'boolean',
					'description' => __( 'Whether visitors get zoom controls.', 'mermaid-blocks' ),
				),
				'download'   => array(
					'type'        => 'boolean',
					'description' => __( 'Whether visitors get buttons that download the diagram as an SVG or PNG file.', 'mermaid-blocks' ),
				),
				'copy'       => array(
					'type'        => 'boolean',
					'description' => __( 'Whether visitors get a button that copies the code of the diagram.', 'mermaid-blocks' ),
				),
				'fullscreen' => array(
					'type'        => 'boolean',
					'description' => __( 'Whether visitors get a button that shows the diagram over the whole screen.', 'mermaid-blocks' ),
				),
				'accTitle'   => array(
					'type'        => 'string',
					'description' => __( 'A title of the diagram for screen readers.', 'mermaid-blocks' ),
				),
				'accDescr'   => array(
					'type'        => 'string',
					'description' => __( 'A description of the diagram for screen readers.', 'mermaid-blocks' ),
				),
				'align'      => array(
					'type'        => 'string',
					'enum'        => array( '', 'center', 'wide', 'full' ),
					'description' => __( 'The alignment of the diagram.', 'mermaid-blocks' ),
				),
			),
			'additionalProperties' => false,
		);
	}

	/**
	 * Returns the schema of a diagram in the output, as
	 * PostDiagrams::describe() returns it.
	 *
	 * @return array The schema.
	 */
	protected function get_diagram_schema(): array {
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
	 * Returns a diagram of a post as it is saved now.
	 *
	 * @param int $post_id The ID of the post.
	 * @param int $index   The index of the diagram.
	 *
	 * @return array|WP_Error The diagram, as PostDiagrams::describe() returns
	 *                        it, or the error.
	 */
	protected function describe_saved( int $post_id, int $index ) {
		$post  = get_post( $post_id );
		$block = $post ? $this->diagrams->get( $post, $index ) : null;

		if ( ! $post || null === $block ) {
			return $this->diagrams->get_not_found_error( $index );
		}

		return $this->diagrams->describe( $post, $index, $block );
	}
}
