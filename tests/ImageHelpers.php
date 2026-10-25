<?php
/**
 * What the tests of the saved images share.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use GraphDraw\Images\ImagesController;
use GraphDraw\Images\SavedImages;
use GraphDraw\Integrations\Block;
use WP_Post;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Posts with diagrams, PNG files to save for them, and requests to the routes
 * that take them.
 */
trait ImageHelpers {

	/**
	 * Returns a PNG file of a given size, as a browser would make it.
	 *
	 * @param int $width  The width, in pixels.
	 * @param int $height The height, in pixels.
	 *
	 * @return string The content of the file.
	 */
	protected function png( int $width = 600, int $height = 300 ): string {
		$chunk = static function ( string $type, string $data ): string {
			return pack( 'N', strlen( $data ) ) . $type . $data . pack( 'N', crc32( $type . $data ) );
		};

		// Each row: no filter, then a red pixel per column.
		$rows = str_repeat( "\x00" . str_repeat( "\xff\x00\x00", $width ), $height );

		return SavedImages::SIGNATURE
			. $chunk( 'IHDR', pack( 'NNCCCCC', $width, $height, 8, 2, 0, 0, 0 ) )
			. $chunk( 'IDAT', gzcompress( $rows ) )
			. $chunk( 'IEND', '' );
	}

	/**
	 * Returns a diagram block.
	 *
	 * @param string $code       The Mermaid source.
	 * @param array  $attributes The other attributes.
	 *
	 * @return array The block, as parse_blocks() returns them.
	 */
	protected function diagram_block( string $code, array $attributes = array() ): array {
		return array(
			'blockName'    => Block::NAME,
			'attrs'        => array( 'code' => $code ) + $attributes,
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);
	}

	/**
	 * Creates a published post that holds diagrams.
	 *
	 * @param array[] $blocks The diagram blocks: see diagram_block().
	 * @param array   $args   Other fields of the post.
	 *
	 * @return WP_Post The post.
	 */
	protected function create_post( array $blocks, array $args = array() ): WP_Post {
		return self::factory()->post->create_and_get(
			array( 'post_content' => wp_slash( serialize_blocks( $blocks ) ) ) + $args + array( 'post_status' => 'publish' )
		);
	}

	/**
	 * Returns the path of a file in the uploads directory.
	 *
	 * @param string $file The file, relative to the directory.
	 *
	 * @return string The path.
	 */
	protected function get_upload_path( string $file ): string {
		$uploads = wp_get_upload_dir();

		return $uploads['basedir'] . '/' . $file;
	}

	/**
	 * Makes a post the one that is being shown, as in the loop.
	 *
	 * @param WP_Post $post The post.
	 */
	protected function enter_post( WP_Post $post ): void {
		$GLOBALS['post'] = $post; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- What the loop does.
		setup_postdata( $post );
	}

	/**
	 * Sends a request to the routes of the saved images.
	 *
	 * @param string      $method The method.
	 * @param string      $route  The route, after the namespace.
	 * @param string|null $body   The body.
	 *
	 * @return WP_REST_Response The response.
	 */
	protected function request( string $method, string $route, ?string $body = null ): WP_REST_Response {
		$request = new WP_REST_Request( $method, '/' . ImagesController::REST_NAMESPACE . $route );

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
	protected function send_image( int $post_id, string $code, string $theme = '' ): WP_REST_Response {
		$key = graphdraw()->get( SavedImages::class )->get_key( $code, $theme );

		return $this->request( 'POST', sprintf( '/posts/%d/images/%s', $post_id, $key ), $this->png() );
	}

	/**
	 * Forgets the REST server a test used: the next test gets one of its own.
	 */
	protected function forget_rest_server(): void {
		global $wp_rest_server;

		$wp_rest_server = null; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- What a test of the REST API does.
	}
}
