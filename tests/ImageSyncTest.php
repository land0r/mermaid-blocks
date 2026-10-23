<?php
/**
 * Tests of the sync of the saved images.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Images\ImageSync;
use MermaidBlocks\Images\SavedImages;
use MermaidBlocks\Options;
use MermaidBlocks\Posts\PostDiagrams;
use WP_UnitTestCase;

require_once __DIR__ . '/ImageHelpers.php';

/**
 * Which diagrams of a post the editor is asked to draw, and what happens to
 * an image when its diagram goes.
 *
 * @covers \MermaidBlocks\Images\ImageSync
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

		$this->images = mermaid_blocks()->get( SavedImages::class );
		$this->sync   = mermaid_blocks()->get( ImageSync::class );

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
	 * The diagrams of a post are those with code, nested ones included, each
	 * with the key of its image and the theme to draw it in: its own, or else
	 * the site's. Two diagrams that look the same share an image.
	 */
	public function test_lists_the_diagrams_of_a_post(): void {
		update_option( Options::THEME, 'neutral' );

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
	 * A diagram that has an image of the other renderer only is still asked
	 * for: the editor draws it again with the site's renderer.
	 */
	public function test_asks_for_the_images_of_the_renderer_of_the_site(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE ) ) );

		update_option( Options::RENDERER, 'mermaid' );
		$this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );
		$this->images->save( $post, $this->images->get_key( self::PIE ), 'auto', $this->png() );
		$this->assertSame( array(), $this->sync->get_missing( $post ) );

		update_option( Options::RENDERER, 'pele' );
		$this->assertSame( array( self::FLOW, self::PIE ), wp_list_pluck( $this->sync->get_missing( $post ), 'code' ) );

		foreach ( $this->sync->get_missing( $post ) as $diagram ) {
			$this->assertSame( $this->images->get_key( $diagram['code'], '', 'pele' ), $diagram['key'] );
		}

		$this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );
		$this->assertSame( array( self::PIE ), wp_list_pluck( $this->sync->get_missing( $post ), 'code' ) );

		// And back to Mermaid.js, whose images are all still there.
		update_option( Options::RENDERER, 'mermaid' );
		$this->assertSame( array(), $this->sync->get_missing( $post ) );
	}

	/**
	 * The other renderer's image stays as a stand-in while a post is saved
	 * before it was drawn again, and goes once the diagram has an image of the
	 * site's renderer: then only images of that renderer are left.
	 */
	public function test_removes_the_other_renderers_images_once_they_are_drawn_again(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE ) ) );

		update_option( Options::RENDERER, 'mermaid' );
		$flow = $this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );
		$pie  = $this->images->save( $post, $this->images->get_key( self::PIE ), 'auto', $this->png() );

		update_option( Options::RENDERER, 'pele' );

		// Saved before the editor drew anything: the stand-ins stay.
		$this->sync->prune( $post->ID );

		$this->assertFileExists( $this->get_upload_path( $flow['file'] ) );
		$this->assertFileExists( $this->get_upload_path( $pie['file'] ) );

		// The post is opened in the editor, which draws what is missing, and saved.
		foreach ( $this->sync->get_missing( $post ) as $diagram ) {
			$this->images->save( $post, $diagram['key'], $diagram['theme'], $this->png() );
		}

		$this->sync->prune( $post->ID );

		$this->assertFileDoesNotExist( $this->get_upload_path( $flow['file'] ) );
		$this->assertFileDoesNotExist( $this->get_upload_path( $pie['file'] ) );

		$renderers = array_unique( wp_list_pluck( $this->images->get_all( $post->ID ), 'renderer' ) );

		$this->assertSame( array( 'pele' ), array_values( $renderers ) );
		$this->assertCount( 2, $this->images->get_all( $post->ID ) );
	}

	/**
	 * A diagram that was drawn again keeps no stand-in, while another that
	 * wasn't yet keeps its own.
	 */
	public function test_keeps_a_stand_in_only_for_a_diagram_not_drawn_again(): void {
		$post = $this->create_post( array( $this->diagram_block( self::FLOW ), $this->diagram_block( self::PIE ) ) );

		update_option( Options::RENDERER, 'mermaid' );
		$flow = $this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );
		$pie  = $this->images->save( $post, $this->images->get_key( self::PIE ), 'auto', $this->png() );

		update_option( Options::RENDERER, 'pele' );
		$this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );

		$this->sync->prune( $post->ID );

		$this->assertFileDoesNotExist( $this->get_upload_path( $flow['file'] ) );
		$this->assertFileExists( $this->get_upload_path( $pie['file'] ) );
		$this->assertNotNull( $this->images->find( $post->ID, self::PIE ) );
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

		update_option( Options::THEME, 'forest' );

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

		$diagrams = mermaid_blocks()->get( PostDiagrams::class );
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
	 * The sync is added when a post is saved, and not before: most requests
	 * save none. It is there in time for that same save.
	 */
	public function test_is_added_when_a_post_is_saved(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::FLOW ) ) );
		$image = $this->images->save( $post, $this->images->get_key( self::FLOW ), 'auto', $this->png() );

		remove_action( 'wp_after_insert_post', array( $this->sync, 'prune' ) );

		wp_update_post(
			array(
				'ID'           => $post->ID,
				'post_content' => '',
			)
		);

		$this->assertSame( 10, has_action( 'wp_after_insert_post', array( $this->sync, 'prune' ) ) );
		$this->assertFileDoesNotExist( $this->get_upload_path( $image['file'] ) );
	}
}
