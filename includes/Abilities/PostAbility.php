<?php
/**
 * The base of the abilities that work on a diagram of a post.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use MermaidBlocks\Posts\EditablePosts;
use MermaidBlocks\Posts\PostDiagrams;
use WP_Error;
use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * An ability that reads or changes a diagram of the post its input names. It
 * finds that post before it runs, so a subclass only says what it does with
 * the post: see run().
 *
 * Its permissions are the block editor's: a user works with the diagrams of
 * the posts they may edit, and with none of the others: see EditablePosts.
 * Reading a diagram needs the same, since it gives the source, as editing the
 * post would. Sites can narrow this with the `wp_ability_permission_result`
 * filter of WordPress 7.1.
 */
abstract class PostAbility extends DiagramAbility {

	/**
	 * The posts diagrams can be in.
	 *
	 * @var EditablePosts
	 */
	protected EditablePosts $posts;

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
	 * Does what the ability does, with the post the input names.
	 *
	 * @param WP_Post $post  The post: one diagrams can be changed in.
	 * @param array   $input The input.
	 *
	 * @return array|WP_Error The result, or the error.
	 */
	abstract protected function run( WP_Post $post, array $input );

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
		return $this->posts->can_edit( $this->get_post_id( $input ) );
	}

	/**
	 * Runs the ability on the post the input names, if diagrams can be
	 * changed in it.
	 *
	 * @param mixed $input The input, with a `post_id`.
	 *
	 * @return array|WP_Error The result of run(), or the error: the post
	 *                        doesn't exist, isn't edited in the block editor,
	 *                        or is in the trash.
	 */
	final public function execute( $input = null ) {
		$input = (array) $input;
		$post  = $this->posts->get( $this->get_post_id( $input ) );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		return $this->run( $post, $input );
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
