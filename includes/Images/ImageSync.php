<?php
/**
 * The saved images of a post, kept in step with its diagrams.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Images;

use MermaidBlocks\Hookable;
use MermaidBlocks\Posts\PostDiagrams;
use MermaidBlocks\Themes;
use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keeps the saved images of a post in step with its diagrams.
 *
 * The server knows which diagrams a post has, and can't draw them. The block
 * editor can. So the editor asks which diagrams of the post it has open have
 * no image, draws those, and sends each image back: see ImagesController for
 * the routes, and src/editor/saved-images.js.
 *
 * When a post is saved, by anything, the images of the diagrams it no longer
 * has are removed: a diagram that an ability changed on the server loses its
 * image there and then. So are the images of the other renderer, once a
 * diagram has one of the site's renderer: until then, the image of the other
 * stands in for it.
 *
 * The diagrams are those in the content of the post, as PostDiagrams finds
 * them. A diagram in a synced pattern or a template part is in another
 * post's content, and gets no image.
 */
final class ImageSync implements Hookable {

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
	 * The themes, which tell the one a diagram is drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * Sets up the sync.
	 *
	 * @param SavedImages  $images   The images.
	 * @param PostDiagrams $diagrams The diagrams in posts.
	 * @param Themes       $themes   The themes.
	 */
	public function __construct( SavedImages $images, PostDiagrams $diagrams, Themes $themes ) {
		$this->images   = $images;
		$this->diagrams = $diagrams;
		$this->themes   = $themes;
	}

	/**
	 * Adds the removal of outdated images to WordPress.
	 */
	public function hooks(): void {
		add_action( 'wp_after_insert_post', array( $this, 'prune' ) );
	}

	/**
	 * Returns the diagrams of a post that can have an image: those with code.
	 *
	 * @param WP_Post $post     The post.
	 * @param string  $renderer Optional. The renderer the images are drawn with.
	 *                          Default: the one of the request.
	 *
	 * @return array[] For each diagram, by the key of its image: that key,
	 *                 the code, and the theme to draw the image in, a name
	 *                 from Themes::get_all(). Two diagrams with the same code
	 *                 and theme share an image.
	 */
	public function get_diagrams( WP_Post $post, string $renderer = '' ): array {
		$diagrams = array();

		foreach ( $this->diagrams->get_all( $post ) as $block ) {
			$code  = isset( $block['attrs']['code'] ) && is_string( $block['attrs']['code'] ) ? $block['attrs']['code'] : '';
			$theme = isset( $block['attrs']['theme'] ) && is_string( $block['attrs']['theme'] ) ? $block['attrs']['theme'] : '';

			if ( '' === trim( $code ) ) {
				continue;
			}

			$key = $this->images->get_key( $code, $theme, $renderer );

			$diagrams[ $key ] = array(
				'key'   => $key,
				'code'  => $code,
				'theme' => $this->themes->resolve( $theme ),
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
	 * @param WP_Post $post     The post.
	 * @param string  $renderer Optional. The renderer the images are drawn with.
	 *                          Default: the one of the request.
	 *
	 * @return array[] The diagrams: see get_diagrams(). None for a post that
	 *                 has no page of its own, such as a synced pattern.
	 */
	public function get_missing( WP_Post $post, string $renderer = '' ): array {
		if ( ! is_post_type_viewable( $post->post_type ) ) {
			return array();
		}

		$images  = $this->images->get_all( $post->ID );
		$missing = array();

		foreach ( $this->get_diagrams( $post, $renderer ) as $key => $diagram ) {
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
	 * Removes the images of the diagrams a post no longer has, and those of the
	 * other renderer that have been drawn again, once the post is saved.
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

		// The images to keep: those of the diagrams as the site's renderer draws them.
		$keep = $this->get_diagrams( $post );

		// And, for a diagram that has none yet, the other renderer's, which stands in.
		foreach ( $this->diagrams->get_all( $post ) as $block ) {
			$code  = isset( $block['attrs']['code'] ) && is_string( $block['attrs']['code'] ) ? $block['attrs']['code'] : '';
			$theme = isset( $block['attrs']['theme'] ) && is_string( $block['attrs']['theme'] ) ? $block['attrs']['theme'] : '';

			if ( '' !== trim( $code ) && ! isset( $images[ $this->images->get_key( $code, $theme ) ] ) ) {
				$keep[ $this->images->get_key( $code, $theme, $this->images->get_other_renderer() ) ] = true;
			}
		}

		$this->images->forget( $post_id, array_keys( array_diff_key( $images, $keep ) ) );
	}
}
