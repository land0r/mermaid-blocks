<?php
/**
 * The posts diagrams can be in, for those who may edit them.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Posts;

use WP_Error;
use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Finds the post a request names, and tells whether the current user may
 * work with its diagrams. The abilities and the REST routes share it, so a
 * post that doesn't exist is reported the same way everywhere.
 *
 * The permissions are the block editor's: a user works with the diagrams of
 * the posts they may edit (`edit_post`), and with none of the others. So
 * contributors reach their own drafts, authors their own posts, and editors
 * and administrators every post, while subscribers and visitors reach none.
 */
final class EditablePosts {

	/**
	 * Returns the post types diagrams can be in: those edited in the block
	 * editor.
	 *
	 * @return string[] The names of the post types.
	 */
	public function get_types(): array {
		$types = array();

		foreach ( get_post_types( array( 'show_in_rest' => true ), 'names' ) as $type ) {
			if ( 'attachment' !== $type && post_type_supports( $type, 'editor' ) ) {
				$types[] = $type;
			}
		}

		return $types;
	}

	/**
	 * Returns a post, whatever its type and status.
	 *
	 * @param int $post_id The ID of the post.
	 *
	 * @return WP_Post|WP_Error The post, or the error for one that doesn't
	 *                          exist.
	 */
	public function find( int $post_id ) {
		$post = get_post( $post_id );

		if ( ! $post ) {
			return new WP_Error(
				'mermaid_blocks_post_not_found',
				__( 'There is no post with this ID.', 'mermaid-blocks' ),
				array( 'status' => 404 )
			);
		}

		return $post;
	}

	/**
	 * Returns a post, if diagrams can be changed in it: a post of a type
	 * edited in the block editor, not in the trash.
	 *
	 * @param int $post_id The ID of the post.
	 *
	 * @return WP_Post|WP_Error The post, or the error.
	 */
	public function get( int $post_id ) {
		$post = $this->find( $post_id );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! in_array( $post->post_type, $this->get_types(), true ) ) {
			return new WP_Error(
				'mermaid_blocks_invalid_post_type',
				__( 'Posts of this type are not edited in the block editor, so they hold no diagrams.', 'mermaid-blocks' ),
				array( 'status' => 400 )
			);
		}

		// As in the editor, which doesn't open posts in the trash.
		if ( 'trash' === $post->post_status ) {
			return new WP_Error(
				'mermaid_blocks_post_in_trash',
				__( 'The post is in the trash. Restore it first.', 'mermaid-blocks' ),
				array( 'status' => 410 )
			);
		}

		return $post;
	}

	/**
	 * Tells whether the current user may edit a post.
	 *
	 * For a post that doesn't exist, whether they may edit posts at all: get()
	 * then says it doesn't exist.
	 *
	 * @param int $post_id The ID of the post.
	 *
	 * @return bool Whether they may.
	 */
	public function can_edit( int $post_id ): bool {
		$post = get_post( $post_id );

		if ( ! $post ) {
			return current_user_can( 'edit_posts' );
		}

		return current_user_can( 'edit_post', $post->ID );
	}
}
