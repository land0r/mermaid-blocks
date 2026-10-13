<?php
/**
 * The saved images of a post, kept in step with its diagrams.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

use WP_Error;
use WP_Post;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keeps the saved images of a post in step with its diagrams.
 *
 * The server knows which diagrams a post has, and can't draw them. The block
 * editor can. So the editor asks which diagrams of the post it has open have
 * no image, draws those, and sends each image back (see
 * src/editor/saved-images.js):
 *
 *     GET  /mermaid-blocks/v1/posts/<id>/images        The diagrams to draw.
 *     POST /mermaid-blocks/v1/posts/<id>/images/<key>  The PNG of one of them.
 *
 * Both are open to those who may edit the post, and exist only while the
 * setting is on. An image is taken only for a diagram the post has at that
 * moment, so nothing is stored for a post that changed in the meantime.
 *
 * When a post is saved, by anything, the images of the diagrams it no longer
 * has are removed: a diagram that an ability changed on the server loses its
 * image there and then.
 *
 * The diagrams are those in the content of the post, as PostDiagrams finds
 * them. A diagram in a synced pattern or a template part is in another
 * post's content, and gets no image.
 */
final class ImageSync {

	/**
	 * The namespace of the routes.
	 */
	const REST_NAMESPACE = 'mermaid-blocks/v1';

	/**
	 * The images.
	 *
	 * @var SavedImages
	 */
	private SavedImages $images;

	/**
	 * The diagrams in posts.
	 *
	 * @var PostDiagrams
	 */
	private PostDiagrams $diagrams;

	/**
	 * The diagram markup, which knows the theme a diagram is drawn in.
	 *
	 * @var Diagram
	 */
	private Diagram $diagram;

	/**
	 * Sets up the sync.
	 *
	 * @param SavedImages  $images   The images.
	 * @param PostDiagrams $diagrams The diagrams in posts.
	 * @param Diagram      $diagram  The diagram markup.
	 */
	public function __construct( SavedImages $images, PostDiagrams $diagrams, Diagram $diagram ) {
		$this->images   = $images;
		$this->diagrams = $diagrams;
		$this->diagram  = $diagram;
	}

	/**
	 * Adds the routes, and the removal of outdated images, to WordPress.
	 */
	public function hooks(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		add_action( 'wp_after_insert_post', array( $this, 'prune' ) );
	}

	/**
	 * Returns the diagrams of a post that can have an image: those with code.
	 *
	 * @param WP_Post $post The post.
	 *
	 * @return array[] For each diagram, by the key of its image: that key,
	 *                 the code, and the theme to draw the image in, a name
	 *                 from Themes::get_all(). Two diagrams with the same code
	 *                 and theme share an image.
	 */
	public function get_diagrams( WP_Post $post ): array {
		$diagrams = array();

		foreach ( $this->diagrams->get_all( $post ) as $block ) {
			$code  = isset( $block['attrs']['code'] ) && is_string( $block['attrs']['code'] ) ? $block['attrs']['code'] : '';
			$theme = isset( $block['attrs']['theme'] ) && is_string( $block['attrs']['theme'] ) ? $block['attrs']['theme'] : '';

			if ( '' === trim( $code ) ) {
				continue;
			}

			$key = $this->images->get_key( $code, $theme );

			$diagrams[ $key ] = array(
				'key'   => $key,
				'code'  => $code,
				'theme' => $this->diagram->get_theme( $theme ),
			);
		}

		return $diagrams;
	}

	/**
	 * Returns the diagrams of a post that the editor should draw: those
	 * without an image, those whose image has lost its file, and those whose
	 * image was drawn in another theme than the one they get now, because the
	 * site's theme changed since. The last keep their image until the new one
	 * arrives.
	 *
	 * @param WP_Post $post The post.
	 *
	 * @return array[] The diagrams: see get_diagrams(). None for a post that
	 *                 has no page of its own, such as a synced pattern.
	 */
	public function get_missing( WP_Post $post ): array {
		if ( ! is_post_type_viewable( $post->post_type ) ) {
			return array();
		}

		$images  = $this->images->get_all( $post->ID );
		$missing = array();

		foreach ( $this->get_diagrams( $post ) as $key => $diagram ) {
			if (
				! isset( $images[ $key ] ) ||
				$images[ $key ]['theme'] !== $diagram['theme'] ||
				! $this->images->has_file( $images[ $key ] )
			) {
				$missing[] = $diagram;
			}
		}

		return $missing;
	}

	/**
	 * Removes the images of the diagrams a post no longer has, once the post
	 * is saved.
	 *
	 * @param int $post_id The ID of the post.
	 */
	public function prune( $post_id ): void {
		$post_id = (int) $post_id;
		$images  = $this->images->get_all( $post_id );

		if ( ! $images ) {
			return;
		}

		$post = get_post( $post_id );

		if ( ! $post ) {
			return;
		}

		$this->images->forget( $post_id, array_keys( array_diff_key( $images, $this->get_diagrams( $post ) ) ) );
	}

	/**
	 * Registers the routes, while the setting is on.
	 */
	public function register_routes(): void {
		if ( ! $this->images->is_on() ) {
			return;
		}

		$post_id = array(
			'description' => __( 'The ID of the post.', 'mermaid-blocks' ),
			'type'        => 'integer',
			'required'    => true,
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/posts/(?P<id>[\d]+)/images',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_items' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array( 'id' => $post_id ),
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
					'id'  => $post_id,
					'key' => array(
						'description' => __( 'The key of the diagram, as the list of diagrams to draw gives it.', 'mermaid-blocks' ),
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
		$post = get_post( (int) $request['id'] );

		if ( ! $post ) {
			return new WP_Error(
				'mermaid_blocks_post_not_found',
				__( 'The post was not found.', 'mermaid-blocks' ),
				array( 'status' => 404 )
			);
		}

		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			return new WP_Error(
				'mermaid_blocks_cannot_edit_post',
				__( 'You are not allowed to edit this post.', 'mermaid-blocks' ),
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
			array( 'missing' => $this->get_missing( get_post( (int) $request['id'] ) ) )
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
		$diagrams = is_post_type_viewable( $post->post_type ) ? $this->get_diagrams( $post ) : array();

		if ( ! isset( $diagrams[ $key ] ) ) {
			return new WP_Error(
				'mermaid_blocks_image_not_wanted',
				__( 'The post has no diagram this image is of. The post may have changed in the meantime.', 'mermaid-blocks' ),
				array( 'status' => 409 )
			);
		}

		$image = $this->images->save( $post, $key, $diagrams[ $key ]['theme'], (string) $request->get_body() );

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
