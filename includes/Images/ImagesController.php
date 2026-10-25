<?php
/**
 * The REST routes of the saved images of a post.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Images;

use GraphDraw\Hookable;
use GraphDraw\Posts\EditablePosts;
use GraphDraw\Renderers;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The routes through which the block editor draws the saved images of a
 * post: it asks which diagrams have none, and sends each image back (see
 * ImageSync, and src/editor/saved-images.js).
 *
 *     GET  /graphdraw/v1/posts/<id>/images        The diagrams to draw.
 *     POST /graphdraw/v1/posts/<id>/images/<key>  The PNG of one of them.
 *
 * Both are open to those who may edit the post, and exist only while the
 * setting is on. An image is taken only for a diagram the post has at that
 * moment, so nothing is stored for a post that changed in the meantime.
 */
final class ImagesController implements Hookable {

	/**
	 * The namespace of the routes.
	 */
	const REST_NAMESPACE = 'graphdraw/v1';

	/**
	 * What tells which diagrams of a post need an image.
	 *
	 * @var ImageSync
	 */
	private ImageSync $sync;

	/**
	 * The images.
	 *
	 * @var SavedImages
	 */
	private SavedImages $images;

	/**
	 * The posts, to find the one a request names.
	 *
	 * @var EditablePosts
	 */
	private EditablePosts $posts;

	/**
	 * Sets up the routes.
	 *
	 * @param ImageSync     $sync   What tells which diagrams need an image.
	 * @param SavedImages   $images The images.
	 * @param EditablePosts $posts  The posts.
	 */
	public function __construct( ImageSync $sync, SavedImages $images, EditablePosts $posts ) {
		$this->sync   = $sync;
		$this->images = $images;
		$this->posts  = $posts;
	}

	/**
	 * Adds the routes to WordPress.
	 */
	public function hooks(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers the routes, while the setting is on.
	 */
	public function register_routes(): void {
		if ( ! $this->images->is_on() ) {
			return;
		}

		$post_id = array(
			'description' => __( 'The ID of the post.', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'type'        => 'integer',
			'required'    => true,
		);

		// The editor says which renderer it draws with: a filter may give the request another one.
		$renderer = array(
			'description' => __( 'The renderer the images are drawn with. Default: the one of the request.', 'graphdraw-mermaid-diagrams-flowcharts' ),
			'type'        => 'string',
			'enum'        => Renderers::ALL,
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/posts/(?P<id>[\d]+)/images',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_items' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'id'       => $post_id,
					'renderer' => $renderer,
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/posts/(?P<id>[\d]+)/images/(?P<key>[a-f0-9]{32})',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'create_item' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'id'       => $post_id,
					'renderer' => $renderer,
					'key'      => array(
						'description' => __( 'The key of the diagram, as the list of diagrams to draw gives it.', 'graphdraw-mermaid-diagrams-flowcharts' ),
						'type'        => 'string',
						'required'    => true,
					),
				),
			)
		);
	}

	/**
	 * Tells whether the current user may edit the post a request names: the
	 * images of a post are for those who can change its diagrams.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return true|WP_Error True, or the error: the post doesn't exist, or
	 *                       the user may not edit it.
	 */
	public function check_permission( $request ) {
		$post = $this->posts->find( (int) $request['id'] );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			return new WP_Error(
				'graphdraw_cannot_edit_post',
				__( 'You are not allowed to edit this post.', 'graphdraw-mermaid-diagrams-flowcharts' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		return true;
	}

	/**
	 * Lists the diagrams of a post that the editor should draw.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response The diagrams, as `missing`: the key, the code
	 *                          and the theme of each.
	 */
	public function get_items( $request ) {
		return rest_ensure_response(
			array( 'missing' => $this->sync->get_missing( get_post( (int) $request['id'] ), (string) $request['renderer'] ) )
		);
	}

	/**
	 * Saves the image of a diagram of a post. The body of the request is the
	 * PNG file.
	 *
	 * @param WP_REST_Request $request The request.
	 *
	 * @return WP_REST_Response|WP_Error The key and the size of the image, or
	 *                                   the error: the post has no such
	 *                                   diagram, or the body is no image
	 *                                   that can be saved.
	 */
	public function create_item( $request ) {
		$post     = get_post( (int) $request['id'] );
		$key      = (string) $request['key'];
		$renderer = (string) $request['renderer'];
		$diagrams = is_post_type_viewable( $post->post_type ) ? $this->sync->get_diagrams( $post, $renderer ) : array();

		if ( ! isset( $diagrams[ $key ] ) ) {
			return new WP_Error(
				'graphdraw_image_not_wanted',
				__( 'The post has no diagram this image is of. The post may have changed in the meantime.', 'graphdraw-mermaid-diagrams-flowcharts' ),
				array( 'status' => 409 )
			);
		}

		$image = $this->images->save( $post, $key, $diagrams[ $key ]['theme'], (string) $request->get_body(), $renderer );

		if ( is_wp_error( $image ) ) {
			return $image;
		}

		$response = rest_ensure_response(
			array(
				'key'    => $key,
				'width'  => $image['width'],
				'height' => $image['height'],
			)
		);
		$response->set_status( 201 );

		return $response;
	}
}
