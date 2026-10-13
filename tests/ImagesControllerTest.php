<?php
/**
 * Tests of the REST routes of the saved images.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Images\ImagesController;
use MermaidBlocks\Images\SavedImages;
use MermaidBlocks\Options;
use MermaidBlocks\Posts\EditablePosts;
use WP_UnitTestCase;

require_once __DIR__ . '/ImageHelpers.php';

/**
 * Which images the editor may send for a post, and who may do so.
 *
 * @covers \MermaidBlocks\Images\ImagesController
 */
class ImagesControllerTest extends WP_UnitTestCase {

	use ImageHelpers;

	/**
	 * The code of two diagrams.
	 */
	const FLOW = "graph TD\nA --> B";
	const PIE  = "pie\n\"a\" : 1";

	/**
	 * The images.
	 *
	 * @var SavedImages
	 */
	private SavedImages $images;

	/**
	 * Starts with the setting on, as an editor.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->images = mermaid_blocks()->get( SavedImages::class );

		update_option( Options::SAVE_IMAGES, 1 );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
	}

	/**
	 * Removes the files the test saved, and the REST server it used.
	 */
	public function tear_down(): void {
		$this->forget_rest_server();
		$this->remove_added_uploads();

		parent::tear_down();
	}

	/**
	 * The editor gets the diagrams to draw, sends an image for each, and is
	 * then asked for none.
	 */
	public function test_routes_take_the_images_of_a_post(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE, array( 'theme' => 'forest' ) ) ) );

		$response = $this->request( 'GET', '/posts/' . $post->ID . '/images' );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame(
			array(
				'missing' => array(
					array(
						'key'   => $this->images->get_key( self::FLOW ),
						'code'  => self::FLOW,
						'theme' => 'auto',
					),
					array(
						'key'   => $this->images->get_key( self::PIE, 'forest' ),
						'code'  => self::PIE,
						'theme' => 'forest',
					),
				),
			),
			$response->get_data()
		);

		$response = $this->send_image( $post->ID, self::PIE, 'forest' );

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame(
			array(
				'key'    => $this->images->get_key( self::PIE, 'forest' ),
				'width'  => 600,
				'height' => 300,
			),
			$response->get_data()
		);
		$this->assertSame( 'forest', $this->images->get_all( $post->ID )[ $this->images->get_key( self::PIE, 'forest' ) ]['theme'] );
		$this->assertNotNull( $this->images->find( $post->ID, self::PIE, 'forest' ) );

		$this->send_image( $post->ID, self::FLOW );

		$this->assertSame( array( 'missing' => array() ), $this->request( 'GET', '/posts/' . $post->ID . '/images' )->get_data() );
	}

	/**
	 * An image is taken only for a diagram the post has: one that changed in
	 * the meantime is refused, and so is a key that isn't one.
	 */
	public function test_route_refuses_an_image_the_post_has_no_diagram_for(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ) ) );

		$response = $this->send_image( $post->ID, self::PIE );

		$this->assertSame( 409, $response->get_status() );
		$this->assertSame( 'mermaid_blocks_image_not_wanted', $response->get_data()['code'] );
		$this->assertSame( 404, $this->request( 'POST', '/posts/' . $post->ID . '/images/not-a-key', $this->png() )->get_status() );
		$this->assertSame( 409, $this->request( 'POST', '/posts/' . $post->ID . '/images/' . strtoupper( $this->images->get_key( self::FLOW ) ), $this->png() )->get_status() );
		$this->assertSame( array(), $this->images->get_all( $post->ID ) );
	}

	/**
	 * What is sent must be a PNG file.
	 */
	public function test_route_refuses_what_is_no_image(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::FLOW ) ) );
		$route = sprintf( '/posts/%d/images/%s', $post->ID, $this->images->get_key( self::FLOW ) );

		foreach ( array( '', '<svg onload="alert(1)"></svg>', '<?php phpinfo();' ) as $body ) {
			$response = $this->request( 'POST', $route, $body );

			$this->assertSame( 400, $response->get_status() );
			$this->assertSame( 'mermaid_blocks_image_invalid', $response->get_data()['code'] );
		}

		$this->assertSame( 400, $this->request( 'POST', $route )->get_status() );
		$this->assertSame( array(), $this->images->get_all( $post->ID ) );
	}

	/**
	 * Roles, with the posts whose images they reach: their own, another
	 * user's published post, another user's draft.
	 *
	 * @return array[] The role, or none for a visitor, and what it reaches.
	 */
	public function data_roles(): array {
		return array(
			'administrator' => array( 'administrator', true, true, true ),
			'editor'        => array( 'editor', true, true, true ),
			'author'        => array( 'author', true, false, false ),
			'contributor'   => array( 'contributor', true, false, false ),
			'subscriber'    => array( 'subscriber', false, false, false ),
			'visitor'       => array( '', false, false, false ),
		);
	}

	/**
	 * The images of a post are for those who may edit it.
	 *
	 * @dataProvider data_roles
	 *
	 * @param string $role      The role.
	 * @param bool   $own       Whether it reaches its own draft.
	 * @param bool   $published Whether it reaches another user's post.
	 * @param bool   $draft     Whether it reaches another user's draft.
	 */
	public function test_routes_are_for_those_who_may_edit_the_post( string $role, bool $own, bool $published, bool $draft ): void {
		$someone = self::factory()->user->create( array( 'role' => 'editor' ) );
		$user    = '' === $role ? 0 : self::factory()->user->create( array( 'role' => $role ) );
		$block   = array( $this->diagram_block( self::FLOW ) );

		$posts = array(
			array(
				$own,
				$this->create_post(
					$block,
					array(
						'post_author' => $user,
						'post_status' => 'draft',
					)
				),
			),
			array( $published, $this->create_post( $block, array( 'post_author' => $someone ) ) ),
			array(
				$draft,
				$this->create_post(
					$block,
					array(
						'post_author' => $someone,
						'post_status' => 'draft',
					)
				),
			),
		);

		wp_set_current_user( $user );

		foreach ( $posts as list( $allowed, $post ) ) {
			$refused = $user ? 403 : 401;

			$this->assertSame( $allowed ? 200 : $refused, $this->request( 'GET', '/posts/' . $post->ID . '/images' )->get_status() );
			$this->assertSame( $allowed ? 201 : $refused, $this->send_image( $post->ID, self::FLOW )->get_status() );
			$this->assertSame( $allowed ? 1 : 0, count( $this->images->get_all( $post->ID ) ) );
		}
	}

	/**
	 * A post that doesn't exist is not found, in the words the abilities use
	 * for it.
	 */
	public function test_routes_do_not_find_a_missing_post(): void {
		$response = $this->request( 'GET', '/posts/999999/images' );

		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( 'mermaid_blocks_post_not_found', $response->get_data()['code'] );
		$this->assertSame(
			mermaid_blocks()->get( EditablePosts::class )->find( 999999 )->get_error_message(),
			$response->get_data()['message']
		);
		$this->assertSame( 404, $this->send_image( 999999, self::FLOW )->get_status() );
	}

	/**
	 * The routes are added when the REST API starts, and not before: most
	 * requests never need them.
	 */
	public function test_routes_are_added_when_the_rest_api_starts(): void {
		$controller = mermaid_blocks()->get( ImagesController::class );

		remove_action( 'rest_api_init', array( $controller, 'register_routes' ) );
		$this->forget_rest_server();

		$this->assertArrayHasKey( '/' . ImagesController::REST_NAMESPACE . '/posts/(?P<id>[\\d]+)/images', rest_get_server()->get_routes() );
		$this->assertSame( 10, has_action( 'rest_api_init', array( $controller, 'register_routes' ) ) );
	}

	/**
	 * While the setting is off there are no routes.
	 */
	public function test_does_nothing_while_the_setting_is_off(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ) ) );

		update_option( Options::SAVE_IMAGES, 0 );

		$this->assertSame( 404, $this->request( 'GET', '/posts/' . $post->ID . '/images' )->get_status() );
		$this->assertSame( 404, $this->send_image( $post->ID, self::FLOW )->get_status() );
		$this->assertSame( array(), $this->images->get_all( $post->ID ) );
	}
}
