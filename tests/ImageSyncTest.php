<?php
/**
 * Tests of the sync of the saved images.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Block;
use MermaidBlocks\ImageSync;
use MermaidBlocks\SavedImages;
use MermaidBlocks\Settings;
use WP_Block_Type_Registry;
use WP_REST_Request;
use WP_REST_Response;
use WP_UnitTestCase;

require_once __DIR__ . '/ImageHelpers.php';

/**
 * Which diagrams of a post the editor is asked to draw, which images it may
 * send, who may do so, and what happens to an image when its diagram goes.
 *
 * @covers \MermaidBlocks\ImageSync
 */
class ImageSyncTest extends WP_UnitTestCase {

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
	 * The sync.
	 *
	 * @var ImageSync
	 */
	private ImageSync $sync;

	/**
	 * Starts with the setting on, as an editor.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->images = mermaid_blocks()->images();
		$this->sync   = mermaid_blocks()->image_sync();

		update_option( SavedImages::OPTION, 1 );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
	}

	/**
	 * Removes the files the test saved, and the REST server it used.
	 */
	public function tear_down(): void {
		global $wp_rest_server;

		$wp_rest_server = null; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- The next test gets a server of its own.

		$this->remove_added_uploads();

		parent::tear_down();
	}

	/**
	 * Sends a request to the REST API.
	 *
	 * @param string      $method The method.
	 * @param string      $route  The route, after the namespace.
	 * @param string|null $body   The body.
	 *
	 * @return WP_REST_Response The response.
	 */
	private function request( string $method, string $route, ?string $body = null ): WP_REST_Response {
		$request = new WP_REST_Request( $method, '/' . ImageSync::REST_NAMESPACE . $route );

		if ( null !== $body ) {
			$request->set_header( 'Content-Type', 'image/png' );
			$request->set_body( $body );
		}

		return rest_get_server()->dispatch( $request );
	}

	/**
	 * Sends the image of a diagram of a post.
	 *
	 * @param int    $post_id The ID of the post.
	 * @param string $code    The code of the diagram.
	 * @param string $theme   The theme chosen for the diagram.
	 *
	 * @return WP_REST_Response The response.
	 */
	private function send_image( int $post_id, string $code, string $theme = '' ): WP_REST_Response {
		return $this->request( 'POST', sprintf( '/posts/%d/images/%s', $post_id, $this->images->get_key( $code, $theme ) ), $this->png() );
	}

	/**
	 * The diagrams of a post are those with code, nested ones included, each
	 * with the key of its image and the theme to draw it in: its own, or else
	 * the site's. Two diagrams that look the same share an image.
	 */
	public function test_lists_the_diagrams_of_a_post(): void {
		update_option( Settings::THEME_OPTION, 'neutral' );

		$group = array(
			'blockName'    => 'core/group',
			'attrs'        => array(),
			'innerBlocks'  => array( $this->diagram_block( self::PIE, array( 'theme' => 'forest' ) ) ),
			'innerHTML'    => '<div class="wp-block-group"></div>',
			'innerContent' => array( '<div class="wp-block-group">', null, '</div>' ),
		);

		$post = $this->create_post(
			array(
				$this->diagram_block( self::FLOW ),
				$group,
				$this->diagram_block( " \n" ),
				$this->diagram_block( self::FLOW, array( 'caption' => 'The same diagram again' ) ),
				$this->diagram_block( self::FLOW, array( 'theme' => 'no-such-theme' ) ),
			)
		);

		$flow    = $this->images->get_key( self::FLOW );
		$pie     = $this->images->get_key( self::PIE, 'forest' );
		$unknown = $this->images->get_key( self::FLOW, 'no-such-theme' );

		$this->assertSame(
			array(
				$flow    => array(
					'key'   => $flow,
					'code'  => self::FLOW,
					'theme' => 'neutral',
				),
				$pie     => array(
					'key'   => $pie,
					'code'  => self::PIE,
					'theme' => 'forest',
				),
				$unknown => array(
					'key'   => $unknown,
					'code'  => self::FLOW,
					'theme' => 'neutral',
				),
			),
			$this->sync->get_diagrams( $post )
		);
	}

	/**
	 * The editor is asked to draw the diagrams that have no image, and no
	 * longer those that got one.
	 */
	public function test_asks_for_the_images_a_post_lacks(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE ) ) );

		$this->assertSame( array( self::FLOW, self::PIE ), wp_list_pluck( $this->sync->get_missing( $post ), 'code' ) );

		$this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );

		$this->assertSame( array( self::PIE ), wp_list_pluck( $this->sync->get_missing( $post ), 'code' ) );
	}

	/**
	 * When the site's theme changes, the diagrams that take it keep their
	 * image, and are drawn again the next time the editor asks.
	 */
	public function test_asks_again_when_the_theme_of_the_site_changed(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE, array( 'theme' => 'dark' ) ) ) );

		foreach ( $this->sync->get_missing( $post ) as $diagram ) {
			$this->images->save( $post, $diagram['key'], $diagram['theme'], $this->png() );
		}
		$this->assertSame( array(), $this->sync->get_missing( $post ) );

		update_option( Settings::THEME_OPTION, 'forest' );

		$this->assertNotNull( $this->images->find( $post->ID, self::FLOW ) );
		$this->assertSame(
			array(
				array(
					'key'   => $this->images->get_key( self::FLOW ),
					'code'  => self::FLOW,
					'theme' => 'forest',
				),
			),
			$this->sync->get_missing( $post )
		);
	}

	/**
	 * An image whose file is gone, on a site moved without its uploads for
	 * example, is drawn again.
	 */
	public function test_asks_again_for_an_image_that_lost_its_file(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::FLOW ) ) );
		$image = $this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );

		$this->assertSame( array(), $this->sync->get_missing( $post ) );

		wp_delete_file( $this->get_upload_path( $image['file'] ) );

		$this->assertSame( array( self::FLOW ), wp_list_pluck( $this->sync->get_missing( $post ), 'code' ) );
		$this->assertSame( 201, $this->send_image( $post->ID, self::FLOW )->get_status() );
		$this->assertFileExists( $this->get_upload_path( $image['file'] ) );
		$this->assertSame( array(), $this->sync->get_missing( $post ) );
	}

	/**
	 * A post that has no page of its own, such as a synced pattern, is shown
	 * inside other posts: its diagrams get no image.
	 */
	public function test_asks_for_nothing_for_a_post_without_a_page(): void {
		$pattern = $this->create_post( array( $this->diagram_block( self::FLOW ) ), array( 'post_type' => 'wp_block' ) );

		$this->assertSame( array(), $this->sync->get_missing( $pattern ) );
		$this->assertSame( 409, $this->send_image( $pattern->ID, self::FLOW )->get_status() );
		$this->assertSame( array(), $this->images->get_all( $pattern->ID ) );
	}

	/**
	 * A diagram that is changed on the server, as the abilities change it,
	 * loses its image at once, and the diagrams around it keep theirs.
	 */
	public function test_removes_the_image_of_a_diagram_that_changed(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE ) ) );
		$flow = $this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );
		$pie  = $this->images->save( $post, $this->images->get_key( self::PIE ), 'auto', $this->png() );

		$diagrams = mermaid_blocks()->post_diagrams();
		$changed  = self::FLOW . "\nB --> C";
		$diagrams->replace( $post, 0, $diagrams->get_hash( $diagrams->get( $post, 0 ) ), $this->diagram_block( $changed ) );

		$this->assertFileDoesNotExist( $this->get_upload_path( $flow['file'] ) );
		$this->assertFileExists( $this->get_upload_path( $pie['file'] ) );
		$this->assertSame( array( $this->images->get_key( self::PIE ) => $pie ), $this->images->get_all( $post->ID ) );
		$this->assertNull( $this->images->find( $post->ID, $changed ) );
		$this->assertSame( array( $changed ), wp_list_pluck( $this->sync->get_missing( get_post( $post->ID ) ), 'code' ) );
	}

	/**
	 * A diagram that is removed, or given another theme, loses its image.
	 */
	public function test_removes_the_images_of_diagrams_a_post_no_longer_has(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE ) ) );
		$flow = $this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );
		$pie  = $this->images->save( $post, $this->images->get_key( self::PIE ), 'auto', $this->png() );

		wp_update_post(
			array(
				'ID'           => $post->ID,
				'post_content' => wp_slash( serialize_blocks( array( $this->diagram_block( self::FLOW, array( 'theme' => 'forest' ) ) ) ) ),
			)
		);

		$this->assertFileDoesNotExist( $this->get_upload_path( $flow['file'] ) );
		$this->assertFileDoesNotExist( $this->get_upload_path( $pie['file'] ) );
		$this->assertFalse( metadata_exists( 'post', $post->ID, SavedImages::META_KEY ) );
	}

	/**
	 * A save that leaves the diagrams as they are leaves their images.
	 */
	public function test_keeps_the_images_of_the_diagrams_a_post_still_has(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::FLOW ) ) );
		$image = $this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );

		wp_update_post(
			array(
				'ID'           => $post->ID,
				'post_title'   => 'Another title',
				'post_content' => wp_slash( "<!-- wp:paragraph -->\n<p>New</p>\n<!-- /wp:paragraph -->\n\n" . $post->post_content ),
			)
		);
		wp_trash_post( $post->ID );

		$this->assertFileExists( $this->get_upload_path( $image['file'] ) );
		$this->assertSame( array( $this->images->get_key( self::FLOW ) => $image ), $this->images->get_all( $post->ID ) );
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
	 * A post that doesn't exist is not found.
	 */
	public function test_routes_do_not_find_a_missing_post(): void {
		$this->assertSame( 404, $this->request( 'GET', '/posts/999999/images' )->get_status() );
		$this->assertSame( 404, $this->send_image( 999999, self::FLOW )->get_status() );
	}

	/**
	 * While the setting is off there are no routes, and the editor isn't
	 * told to draw.
	 */
	public function test_does_nothing_while_the_setting_is_off(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ) ) );

		update_option( SavedImages::OPTION, 0 );

		$this->assertSame( 404, $this->request( 'GET', '/posts/' . $post->ID . '/images' )->get_status() );
		$this->assertSame( 404, $this->send_image( $post->ID, self::FLOW )->get_status() );
		$this->assertSame( array(), $this->images->get_all( $post->ID ) );
		$this->assertStringContainsString( '"saveImages":false', $this->get_editor_settings() );
	}

	/**
	 * With the setting on, the editor is told to draw the images.
	 */
	public function test_tells_the_editor_to_draw_the_images(): void {
		$this->assertStringContainsString( '"saveImages":true', $this->get_editor_settings() );
	}

	/**
	 * Returns what the block tells its editor script.
	 *
	 * @return string The script printed before the editor script, last.
	 */
	private function get_editor_settings(): string {
		mermaid_blocks()->block()->add_editor_settings();

		$handles = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME )->editor_script_handles;
		$before  = (array) wp_scripts()->get_data( end( $handles ), 'before' );

		return (string) end( $before );
	}
}
