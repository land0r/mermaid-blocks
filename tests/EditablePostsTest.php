<?php
/**
 * Tests of the posts diagrams can be in.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Posts\EditablePosts;
use WP_Error;
use WP_Post;
use WP_UnitTestCase;

/**
 * Which posts are found, and who may work with their diagrams.
 *
 * @covers \MermaidBlocks\Posts\EditablePosts
 */
class EditablePostsTest extends WP_UnitTestCase {

	/**
	 * The posts.
	 *
	 * @var EditablePosts
	 */
	private EditablePosts $posts;

	/**
	 * Gets the posts.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->posts = mermaid_blocks()->get( EditablePosts::class );
	}

	/**
	 * Asserts that a result is an error with a code and an HTTP status.
	 *
	 * @param string $code   The code.
	 * @param int    $status The status.
	 * @param mixed  $result The result.
	 */
	private function assertError( string $code, int $status, $result ): void {
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( $code, $result->get_error_code() );
		$this->assertSame( array( 'status' => $status ), $result->get_error_data() );
	}

	/**
	 * Diagrams can be in the post types edited in the block editor: not in
	 * attachments, and not in types that have no editor or no REST API.
	 */
	public function test_lists_the_post_types_of_the_block_editor(): void {
		register_post_type(
			'mb_no_editor',
			array(
				'show_in_rest' => true,
				'supports'     => array( 'title' ),
			)
		);
		register_post_type(
			'mb_no_rest',
			array(
				'show_in_rest' => false,
				'supports'     => array( 'title', 'editor' ),
			)
		);
		register_post_type(
			'mb_book',
			array(
				'show_in_rest' => true,
				'supports'     => array( 'title', 'editor' ),
			)
		);

		$types = $this->posts->get_types();

		$this->assertContains( 'post', $types );
		$this->assertContains( 'page', $types );
		$this->assertContains( 'mb_book', $types );
		$this->assertNotContains( 'attachment', $types );
		$this->assertNotContains( 'mb_no_editor', $types );
		$this->assertNotContains( 'mb_no_rest', $types );

		unregister_post_type( 'mb_no_editor' );
		unregister_post_type( 'mb_no_rest' );
		unregister_post_type( 'mb_book' );
	}

	/**
	 * A post is found whatever its type and status, and one that doesn't
	 * exist is an error.
	 */
	public function test_finds_a_post(): void {
		$attachment = self::factory()->attachment->create();
		$trashed    = self::factory()->post->create( array( 'post_status' => 'trash' ) );

		$this->assertSame( $attachment, $this->posts->find( $attachment )->ID );
		$this->assertSame( $trashed, $this->posts->find( $trashed )->ID );
		$this->assertError( 'mermaid_blocks_post_not_found', 404, $this->posts->find( 999999 ) );
		$this->assertError( 'mermaid_blocks_post_not_found', 404, $this->posts->find( 0 ) );
	}

	/**
	 * Diagrams can be changed in a post of the block editor that is not in
	 * the trash. Each other post has an error that says why not.
	 */
	public function test_gets_a_post_diagrams_can_be_changed_in(): void {
		$draft = self::factory()->post->create( array( 'post_status' => 'draft' ) );
		$page  = self::factory()->post->create( array( 'post_type' => 'page' ) );

		$this->assertInstanceOf( WP_Post::class, $this->posts->get( $draft ) );
		$this->assertSame( $page, $this->posts->get( $page )->ID );

		$this->assertError( 'mermaid_blocks_post_not_found', 404, $this->posts->get( 999999 ) );
		$this->assertError( 'mermaid_blocks_invalid_post_type', 400, $this->posts->get( self::factory()->attachment->create() ) );
		$this->assertError( 'mermaid_blocks_post_in_trash', 410, $this->posts->get( self::factory()->post->create( array( 'post_status' => 'trash' ) ) ) );
	}

	/**
	 * Roles, with the posts they may edit: their own draft, another user's
	 * published post, and whether they may edit posts at all.
	 *
	 * @return array[] The role, or none for a visitor, and what it reaches.
	 */
	public function data_roles(): array {
		return array(
			'administrator' => array( 'administrator', true, true, true ),
			'editor'        => array( 'editor', true, true, true ),
			'author'        => array( 'author', true, false, true ),
			'contributor'   => array( 'contributor', true, false, true ),
			'subscriber'    => array( 'subscriber', false, false, false ),
			'visitor'       => array( '', false, false, false ),
		);
	}

	/**
	 * A user works with the diagrams of the posts they may edit. For a post
	 * that doesn't exist, the answer is whether they may edit posts at all,
	 * so that those who may are told it doesn't exist.
	 *
	 * @dataProvider data_roles
	 *
	 * @param string $role   The role.
	 * @param bool   $own    Whether it reaches its own draft.
	 * @param bool   $others Whether it reaches another user's post.
	 * @param bool   $any    Whether it may edit posts at all.
	 */
	public function test_tells_who_may_edit_a_post( string $role, bool $own, bool $others, bool $any ): void {
		$someone = self::factory()->user->create( array( 'role' => 'editor' ) );
		$user    = '' === $role ? 0 : self::factory()->user->create( array( 'role' => $role ) );

		$draft = self::factory()->post->create(
			array(
				'post_author' => $user,
				'post_status' => 'draft',
			)
		);
		$post  = self::factory()->post->create( array( 'post_author' => $someone ) );

		wp_set_current_user( $user );

		$this->assertSame( $own, $this->posts->can_edit( $draft ) );
		$this->assertSame( $others, $this->posts->can_edit( $post ) );
		$this->assertSame( $any, $this->posts->can_edit( 999999 ) );
	}
}
