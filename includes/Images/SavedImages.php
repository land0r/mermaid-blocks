<?php
/**
 * The saved images of diagrams.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Images;

use MermaidBlocks\Hookable;
use MermaidBlocks\Options;
use MermaidBlocks\Renderers;
use WP_Error;
use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keeps an image of a diagram for readers that run no JavaScript: feeds,
 * crawlers, and browsers with scripting off. Without one they get the Mermaid
 * source as text.
 *
 * PHP can't draw Mermaid, so the images come from the block editor, which
 * draws the diagrams of a post that have none yet: see ImageSync. It is a
 * setting, off by default.
 *
 * - **An image is a PNG file**, not the SVG of the diagram. An SVG holds
 *   markup that would need sanitising on the way in and on the way out, its
 *   HTML labels included, and feed readers and mail clients show a PNG where
 *   many drop an SVG. A PNG is checked as an image and saved under a name
 *   made here, so nothing of what was uploaded is ever output as markup.
 * - **The files are in a directory of their own in uploads**, and each post
 *   lists its images in one post meta field. In the post's content an image
 *   would bloat it and pass through kses; as an attachment it would show in
 *   the media library and outlive its diagram. The post meta is loaded with
 *   the post, so a page view that shows a diagram costs no query.
 * - **An image is found by its key**: a hash of the code and of the theme of
 *   the diagram, and, for Pele, of the renderer: Mermaid.js's key is what it
 *   was before there was a choice, so its images keep working. A diagram that
 *   changed, in the editor or on the server, has another key and so no image,
 *   until the editor draws it again. Nothing has to notice the change for an
 *   outdated image to stop being shown. After the site switched renderer, the
 *   image of the other renderer stands in until the post is drawn again.
 * - **An image holds SCALE times the pixels it is shown at**, to stay sharp
 *   on dense screens.
 */
final class SavedImages implements Hookable {

	/**
	 * The post meta field that lists the images of a post, by key: for each,
	 * its file, relative to the uploads directory, its size in pixels, and
	 * the theme it was drawn in and the renderer.
	 */
	const META_KEY = '_mermaid_blocks_images';

	/**
	 * The directory of the images, in the uploads directory.
	 */
	const DIRECTORY = 'mermaid-blocks';

	/**
	 * How many pixels of an image make one pixel of the page.
	 */
	const SCALE = 2;

	/**
	 * The largest file accepted, in bytes.
	 */
	const MAX_BYTES = 8388608;

	/**
	 * The longest side accepted, in pixels: the longest a browser draws.
	 */
	const MAX_SIDE = 16384;

	/**
	 * What every PNG file starts with.
	 */
	const SIGNATURE = "\x89PNG\r\n\x1a\n";

	/**
	 * The stored settings, which hold the switch.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * Sets up the images.
	 *
	 * @param Options $options The stored settings.
	 */
	public function __construct( Options $options ) {
		$this->options = $options;
	}

	/**
	 * Removes the images of a post with it. Also while the setting is off:
	 * the images made before it was switched off are still there.
	 */
	public function hooks(): void {
		add_action( 'before_delete_post', array( $this, 'delete_all' ) );
	}

	/**
	 * Tells whether images of diagrams are saved and shown: a switch on the
	 * settings page.
	 *
	 * @return bool Whether the setting is on.
	 */
	public function is_on(): bool {
		return $this->options->is_on( Options::SAVE_IMAGES );
	}

	/**
	 * Returns the key of the image of a diagram.
	 *
	 * @param string $code     The Mermaid source.
	 * @param string $theme    Optional. The theme chosen for the diagram, as its
	 *                         block has it: an empty string for a diagram that
	 *                         takes the site's theme.
	 * @param string $renderer Optional. The renderer of the image. Default: the
	 *                         one of the request.
	 *
	 * @return string The key: 32 hexadecimal digits. The key of an image of
	 *                Mermaid.js doesn't name the renderer, as it never did.
	 */
	public function get_key( string $code, string $theme = '', string $renderer = '' ): string {
		$renderer = $this->get_renderer( $renderer );

		if ( Renderers::MERMAID === $renderer ) {
			return md5( $theme . "\n" . $code );
		}

		return md5( $renderer . "\n" . $theme . "\n" . $code );
	}

	/**
	 * Returns the other renderer: the one whose image stands in for the one of
	 * the request until it is drawn.
	 *
	 * @return string The name of the renderer.
	 */
	public function get_other_renderer(): string {
		return Renderers::PELE === $this->get_renderer() ? Renderers::MERMAID : Renderers::PELE;
	}

	/**
	 * Returns a renderer, the request's when none is given.
	 *
	 * @param string $renderer Optional. A renderer.
	 *
	 * @return string One of Renderers::ALL.
	 */
	private function get_renderer( string $renderer = '' ): string {
		return Renderers::exists( $renderer ) ? $renderer : $this->options->get_renderer();
	}

	/**
	 * Returns the images of a post.
	 *
	 * The field is read as something anyone could have written: an import,
	 * or a plugin that copies a post with its meta. An entry counts only if it
	 * names, by a key, the file this class would have saved for that key and
	 * that post. So no other file is ever shown or deleted, and a copy of a
	 * post doesn't take the images of the post it was copied from along.
	 *
	 * @param int $post_id The ID of the post.
	 *
	 * @return array[] The file, the width, the height, the theme and the
	 *                 renderer of each image, by key.
	 */
	public function get_all( int $post_id ): array {
		$stored = get_post_meta( $post_id, self::META_KEY, true );
		$images = array();

		if ( ! is_array( $stored ) ) {
			return $images;
		}

		foreach ( $stored as $key => $image ) {
			if (
				! is_string( $key ) ||
				! preg_match( '/^[a-f0-9]{32}$/', $key ) ||
				! is_array( $image ) ||
				! isset( $image['file'], $image['width'], $image['height'] ) ||
				! $this->is_own_file( $image['file'], $post_id, $key )
			) {
				continue;
			}

			$images[ $key ] = array(
				'file'     => $image['file'],
				'width'    => max( 1, (int) $image['width'] ),
				'height'   => max( 1, (int) $image['height'] ),
				'theme'    => isset( $image['theme'] ) && is_string( $image['theme'] ) ? $image['theme'] : '',
				// Images saved before there was a choice are Mermaid.js's.
				'renderer' => isset( $image['renderer'] ) && Renderers::exists( $image['renderer'] ) ? $image['renderer'] : Renderers::MERMAID,
			);
		}

		return $images;
	}

	/**
	 * Returns the image to show for a diagram, if it has one: the one of the
	 * request's renderer, or else the other renderer's, in its old look, until
	 * the post is drawn again with this one.
	 *
	 * The post's meta is looked at before the setting: the first comes with
	 * the post, the second is an option, which a page without images then
	 * never reads.
	 *
	 * @param int|false $post_id The ID of the post the diagram is in, or false
	 *                           outside of a post.
	 * @param string    $code    The Mermaid source.
	 * @param string    $theme   Optional. The theme chosen for the diagram.
	 *
	 * @return array|null The URL of the image, and the width and the height to
	 *                    show it at. Null when the diagram has no image, which
	 *                    is also what a diagram that changed has, and while the
	 *                    setting is off.
	 */
	public function find( $post_id, string $code, string $theme = '' ): ?array {
		if ( ! $post_id ) {
			return null;
		}

		$images = $this->get_all( (int) $post_id );
		$key    = $this->get_key( $code, $theme );

		if ( ! isset( $images[ $key ] ) ) {
			$key = $this->get_key( $code, $theme, $this->get_other_renderer() );
		}

		if ( ! isset( $images[ $key ] ) || ! $this->is_on() ) {
			return null;
		}

		$uploads = wp_get_upload_dir();
		$url     = $uploads['baseurl'] . '/' . $images[ $key ]['file'];

		// As for an attachment: a page served over HTTPS gets no image over HTTP, whatever the site's address says.
		if ( is_ssl() ) {
			$url = set_url_scheme( $url, 'https' );
		}

		return array(
			'url'    => $url,
			'width'  => max( 1, (int) round( $images[ $key ]['width'] / self::SCALE ) ),
			'height' => max( 1, (int) round( $images[ $key ]['height'] / self::SCALE ) ),
		);
	}

	/**
	 * Tells whether the file of an image is where it was saved. A site that
	 * was moved without its uploads has the list of images, and no files.
	 *
	 * It looks at the disk, so it is for the editor, not for a page view.
	 *
	 * @param array $image An image, as get_all() returns them.
	 *
	 * @return bool Whether the file exists.
	 */
	public function has_file( array $image ): bool {
		return file_exists( $this->get_path( $image['file'] ) );
	}

	/**
	 * Tells whether the image of a diagram is shown in place of its source,
	 * rather than next to it for browsers that run no JavaScript.
	 *
	 * @return bool True in feeds, where nothing renders the source.
	 */
	public function replaces_source(): bool {
		/**
		 * Filters whether the saved image of a diagram is output in place of
		 * its source.
		 *
		 * By default it is in feeds. Elsewhere the image is output in a
		 * `<noscript>` element, before the source the script renders. Return
		 * true where no script will run, such as in the content of an email.
		 *
		 * @param bool $replaces Whether the image replaces the source.
		 */
		return (bool) apply_filters( 'mermaid_blocks_image_replaces_source', is_feed() );
	}

	/**
	 * Saves the image of a diagram of a post.
	 *
	 * @param WP_Post $post     The post.
	 * @param string  $key      The key of the diagram: see get_key().
	 * @param string  $theme    The theme the image was drawn in.
	 * @param string  $png      The image: the content of a PNG file.
	 * @param string  $renderer Optional. The renderer it was drawn with.
	 *                          Default: the one of the request.
	 *
	 * @return array|WP_Error The file, the width, the height, the theme and the
	 *                        renderer of the image, or the error: what was
	 *                        given is no PNG, or too large, or couldn't be
	 *                        written.
	 */
	public function save( WP_Post $post, string $key, string $theme, string $png, string $renderer = '' ) {
		$size = $this->get_size( $png );

		if ( is_wp_error( $size ) ) {
			return $size;
		}

		if ( ! preg_match( '/^[a-f0-9]{32}$/', $key ) ) {
			return new WP_Error(
				'mermaid_blocks_image_invalid',
				__( 'The key of the image is not valid.', 'mermaid-blocks' ),
				array( 'status' => 400 )
			);
		}

		// An image drawn again, in another theme, replaces the one before it.
		$this->forget( $post->ID, array( $key ) );

		$renderer = $this->get_renderer( $renderer );

		// The name tells the theme, and Pele, so an image drawn again has another URL than the one caches may hold.
		$name = sprintf(
			'%d-%s-%s%s.png',
			$post->ID,
			$key,
			Renderers::MERMAID === $renderer ? '' : $renderer . '-',
			sanitize_key( $theme )
		);

		// WordPress creates a directory it hasn't seen in this request, not one that was removed since.
		wp_mkdir_p( $this->get_path( self::DIRECTORY ) );

		add_filter( 'upload_dir', array( $this, 'filter_upload_dir' ) );
		$upload = wp_upload_bits( $name, null, $png );
		remove_filter( 'upload_dir', array( $this, 'filter_upload_dir' ) );

		if ( ! empty( $upload['error'] ) ) {
			return new WP_Error(
				'mermaid_blocks_image_not_saved',
				sprintf(
					/* translators: %s: The reason, such as "Unable to create directory". */
					__( 'The image could not be saved: %s', 'mermaid-blocks' ),
					$upload['error']
				),
				array( 'status' => 500 )
			);
		}

		$image = array(
			'file'     => self::DIRECTORY . '/' . wp_basename( $upload['file'] ),
			'width'    => $size['width'],
			'height'   => $size['height'],
			'theme'    => $theme,
			'renderer' => $renderer,
		);

		$images         = $this->get_all( $post->ID );
		$images[ $key ] = $image;

		update_post_meta( $post->ID, self::META_KEY, wp_slash( $images ) );

		return $image;
	}

	/**
	 * Removes images of a post: their files, and their entries in the field.
	 *
	 * @param int      $post_id The ID of the post.
	 * @param string[] $keys    The keys of the images.
	 */
	public function forget( int $post_id, array $keys ): void {
		$images  = $this->get_all( $post_id );
		$removed = array_intersect_key( $images, array_flip( $keys ) );

		if ( ! $removed ) {
			return;
		}

		foreach ( $removed as $image ) {
			wp_delete_file( $this->get_path( $image['file'] ) );
		}

		$images = array_diff_key( $images, $removed );

		if ( $images ) {
			update_post_meta( $post_id, self::META_KEY, wp_slash( $images ) );
		} else {
			delete_post_meta( $post_id, self::META_KEY );
		}
	}

	/**
	 * Removes every image of a post, when the post is deleted.
	 *
	 * @param int $post_id The ID of the post.
	 */
	public function delete_all( $post_id ): void {
		$post_id = (int) $post_id;

		$this->forget( $post_id, array_keys( $this->get_all( $post_id ) ) );
	}

	/**
	 * Points an upload at the directory of the images, while one is saved.
	 *
	 * @param array $uploads The uploads directory: see wp_upload_dir().
	 *
	 * @return array The same, with the directory of the images as the one
	 *               files go to.
	 */
	public function filter_upload_dir( $uploads ) {
		$uploads['subdir'] = '/' . self::DIRECTORY;
		$uploads['path']   = $uploads['basedir'] . $uploads['subdir'];
		$uploads['url']    = $uploads['baseurl'] . $uploads['subdir'];

		return $uploads;
	}

	/**
	 * Returns the size of an image, once it is known to be one that can be
	 * saved: a PNG, of a size a browser draws.
	 *
	 * The file isn't trusted for what it says it is. It must start as a PNG
	 * does and be read as one. It is then saved under a name made here, with
	 * the `.png` extension, so a server never runs it and a browser never
	 * takes it for anything but an image.
	 *
	 * @param string $png The content of the file.
	 *
	 * @return array|WP_Error The width and the height, in pixels, or the error.
	 */
	private function get_size( string $png ) {
		if ( strlen( $png ) > self::MAX_BYTES ) {
			return new WP_Error(
				'mermaid_blocks_image_too_large',
				__( 'The image is too large.', 'mermaid-blocks' ),
				array( 'status' => 413 )
			);
		}

		$size = 0 === strpos( $png, self::SIGNATURE ) ? @getimagesizefromstring( $png ) : false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- It warns about a file that is no image, which is what is checked here.

		if ( ! $size || IMAGETYPE_PNG !== $size[2] || $size[0] < 1 || $size[1] < 1 ) {
			return new WP_Error(
				'mermaid_blocks_image_invalid',
				__( 'The image is not a PNG file.', 'mermaid-blocks' ),
				array( 'status' => 400 )
			);
		}

		if ( $size[0] > self::MAX_SIDE || $size[1] > self::MAX_SIDE ) {
			return new WP_Error(
				'mermaid_blocks_image_too_large',
				__( 'The image is too large.', 'mermaid-blocks' ),
				array( 'status' => 413 )
			);
		}

		return array(
			'width'  => (int) $size[0],
			'height' => (int) $size[1],
		);
	}

	/**
	 * Tells whether a path names the file this class saved for an image of a
	 * post: a PNG file directly in the directory of the images, named after
	 * the post and the key. Something may follow the two, such as the theme.
	 *
	 * @param mixed  $file    A path, relative to the uploads directory.
	 * @param int    $post_id The ID of the post.
	 * @param string $key     The key of the image.
	 *
	 * @return bool Whether the file may be shown and deleted.
	 */
	private function is_own_file( $file, int $post_id, string $key ): bool {
		$pattern = sprintf( '#^%s/%d-%s-[a-z0-9_-]*\.png$#', self::DIRECTORY, $post_id, $key );

		return is_string( $file ) && 1 === preg_match( $pattern, $file );
	}

	/**
	 * Returns the path of an image.
	 *
	 * @param string $file The file, relative to the uploads directory.
	 *
	 * @return string The path.
	 */
	private function get_path( string $file ): string {
		$uploads = wp_get_upload_dir();

		return $uploads['basedir'] . '/' . $file;
	}
}
