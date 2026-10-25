<?php
/**
 * The `graphdraw/list-diagrams` ability.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Abilities;

use GraphDraw\Integrations\Block;
use GraphDraw\Posts\EditablePosts;
use GraphDraw\Posts\PostDiagrams;
use WP_Post;
use WP_Query;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lists the diagrams of one post, or of every post that has some, page by
 * page. Only posts the current user may edit are listed: all of them for
 * those who may edit the posts of others, their own for the others.
 */
final class ListDiagrams extends DiagramAbility {

	/**
	 * The number of posts on a page, by default.
	 */
	const PER_PAGE = 10;

	/**
	 * The posts diagrams can be in.
	 *
	 * @var EditablePosts
	 */
	private EditablePosts $posts;

	/**
	 * Sets up the ability.
	 *
	 * @param PostDiagrams  $diagrams The diagrams in posts.
	 * @param Schemas       $schemas  The schemas the abilities share.
	 * @param EditablePosts $posts    The posts diagrams can be in.
	 */
	public function __construct( PostDiagrams $diagrams, Schemas $schemas, EditablePosts $posts ) {
		parent::__construct( $diagrams, $schemas );

		$this->posts = $posts;
	}

	/**
	 * Returns the name of the ability.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return 'graphdraw/list-diagrams';
	}

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	protected function get_label(): string {
		return __( 'List diagrams', 'graphdraw-mermaid-diagrams-flowcharts' );
	}

	/**
	 * Returns what the ability does.
	 *
	 * @return string The description.
	 */
	protected function get_description(): string {
		return __( 'Lists the Mermaid diagrams in one post, or in every post that has some, most recently changed first. Each diagram comes with its code, its attributes, and the index and hash that address it.', 'graphdraw-mermaid-diagrams-flowcharts' );
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
				'post_id'   => array_merge(
					$this->schemas->get_post_id(),
					array( 'description' => __( 'The ID of a post, to list only its diagrams.', 'graphdraw-mermaid-diagrams-flowcharts' ) )
				),
				'post_type' => array(
					'type'        => 'string',
					'enum'        => $this->posts->get_types(),
					'description' => __( 'A post type, to list only the diagrams in posts of that type.', 'graphdraw-mermaid-diagrams-flowcharts' ),
				),
				'page'      => array(
					'type'    => 'integer',
					'minimum' => 1,
					'default' => 1,
				),
				'per_page'  => array(
					'type'        => 'integer',
					'minimum'     => 1,
					'maximum'     => 100,
					'default'     => self::PER_PAGE,
					'description' => __( 'The number of posts on a page.', 'graphdraw-mermaid-diagrams-flowcharts' ),
				),
			),
			'additionalProperties' => false,
			'default'              => array(),
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
				'posts'       => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'id'        => array( 'type' => 'integer' ),
							'title'     => array( 'type' => 'string' ),
							'post_type' => array( 'type' => 'string' ),
							'status'    => array( 'type' => 'string' ),
							'diagrams'  => array(
								'type'  => 'array',
								'items' => $this->schemas->get_diagram(),
							),
						),
					),
				),
				'total'       => array(
					'type'        => 'integer',
					'description' => __( 'The number of posts with diagrams.', 'graphdraw-mermaid-diagrams-flowcharts' ),
				),
				'total_pages' => array( 'type' => 'integer' ),
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
	 * Tells whether the current user may list the diagrams: of the post they
	 * name, whether they may edit it, and of every post, whether they may edit
	 * posts at all.
	 *
	 * @param mixed $input The input.
	 *
	 * @return bool Whether the user may run the ability.
	 */
	public function check_permissions( $input = null ) {
		$post_id = $this->get_post_id( $input );

		if ( $post_id ) {
			return $this->posts->can_edit( $post_id );
		}

		return current_user_can( 'edit_posts' );
	}

	/**
	 * Lists the diagrams.
	 *
	 * @param mixed $input The input.
	 *
	 * @return array|\WP_Error The posts with their diagrams, or the error.
	 */
	public function execute( $input = null ) {
		$input   = (array) $input;
		$post_id = $this->get_post_id( $input );

		if ( $post_id ) {
			$post = $this->posts->get( $post_id );

			if ( is_wp_error( $post ) ) {
				return $post;
			}

			return array(
				'posts'       => array( $this->describe_post( $post ) ),
				'total'       => 1,
				'total_pages' => 1,
			);
		}

		$post_types = isset( $input['post_type'] ) ? array( (string) $input['post_type'] ) : $this->posts->get_types();

		// Only the types the user may edit posts of: not templates, for an editor.
		$post_types = array_values( array_filter( $post_types, array( $this, 'can_edit_posts_of' ) ) );

		if ( ! $post_types ) {
			return array(
				'posts'       => array(),
				'total'       => 0,
				'total_pages' => 0,
			);
		}

		$args = array(
			'post_type'           => $post_types,
			'post_status'         => array( 'publish', 'future', 'draft', 'pending', 'private' ),
			's'                   => 'wp:' . Block::NAME,
			'search_columns'      => array( 'post_content' ),
			'orderby'             => 'modified',
			'order'               => 'DESC',
			'posts_per_page'      => isset( $input['per_page'] ) ? absint( $input['per_page'] ) : self::PER_PAGE,
			'paged'               => isset( $input['page'] ) ? absint( $input['page'] ) : 1,
			'ignore_sticky_posts' => true,
		);

		/*
		 * Those who may not edit the posts of others get their own. The query's
		 * `perm` argument can't tell: across post types, it asks for a
		 * capability no one has, and leaves out the drafts of others for all.
		 */
		if ( ! $this->can_edit_others( $post_types ) ) {
			$args['author'] = get_current_user_id();
		}

		$query = new WP_Query( $args );
		$posts = array();

		foreach ( $query->posts as $post ) {
			// Some posts stay out of reach, such as the published posts of a contributor.
			if ( current_user_can( 'edit_post', $post->ID ) ) {
				$posts[] = $this->describe_post( $post );
			}
		}

		return array(
			'posts'       => $posts,
			'total'       => (int) $query->found_posts,
			'total_pages' => (int) $query->max_num_pages,
		);
	}

	/**
	 * Describes a post and its diagrams.
	 *
	 * @param WP_Post $post The post.
	 *
	 * @return array The post's ID, title, type and status, and its diagrams.
	 */
	private function describe_post( WP_Post $post ): array {
		$diagrams = array();

		foreach ( $this->diagrams->get_all( $post ) as $index => $block ) {
			$diagrams[] = $this->diagrams->describe( $post, $index, $block );
		}

		return array(
			'id'        => $post->ID,
			'title'     => $post->post_title,
			'post_type' => $post->post_type,
			'status'    => $post->post_status,
			'diagrams'  => $diagrams,
		);
	}

	/**
	 * Tells whether the current user may edit posts of a type.
	 *
	 * @param string $post_type The name of the post type.
	 *
	 * @return bool True when they may edit some.
	 */
	private function can_edit_posts_of( string $post_type ): bool {
		$object = get_post_type_object( $post_type );

		return $object && current_user_can( $object->cap->edit_posts );
	}

	/**
	 * Tells whether the current user may edit the posts of others, of every
	 * post type given.
	 *
	 * @param string[] $post_types The names of the post types.
	 *
	 * @return bool True when they may, for each type.
	 */
	private function can_edit_others( array $post_types ): bool {
		foreach ( $post_types as $post_type ) {
			$object = get_post_type_object( $post_type );

			if ( ! $object || ! current_user_can( $object->cap->edit_others_posts ) ) {
				return false;
			}
		}

		return true;
	}
}
