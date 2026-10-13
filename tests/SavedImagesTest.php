<?php
/**
 * Tests of the saved images.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\SavedImages;
use MermaidBlocks\Settings;
use WP_Error;
use WP_UnitTestCase;

require_once __DIR__ . '/ImageHelpers.php';

/**
 * The images of diagrams: what is accepted as one, where it is kept, and
 * when it is found again.
 *
 * @covers \MermaidBlocks\SavedImages
 */
class SavedImagesTest extends WP_UnitTestCase {

	use ImageHelpers;

	/**
	 * The code of a diagram.
	 */
	const CODE = "graph TD\nA --> B";

	/**
	 * The images.
	 *
	 * @var SavedImages
	 */
	private SavedImages $images;

	/**
	 * Starts with the setting on.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->images = mermaid_blocks()->images();

		update_option( SavedImages::OPTION, 1 );
	}

	/**
	 * Removes the files the test saved.
	 */
	public function tear_down(): void {
		$this->remove_added_uploads();

		parent::tear_down();
	}

	/**
	 * The key is a hash that changes with the code and with the theme, and
	 * with nothing else.
	 */
	public function test_key_changes_with_the_code_and_the_theme(): void {
		$key = $this->images->get_key( self::CODE );

		$this->assertMatchesRegularExpression( '/^[a-f0-9]{32}$/', $key );
		$this->assertSame( $key, $this->images->get_key( self::CODE, '' ) );
		$this->assertNotSame( $key, $this->images->get_key( self::CODE . ' ' ) );
		$this->assertNotSame( $key, $this->images->get_key( self::CODE, 'forest' ) );
		$this->assertNotSame( $this->images->get_key( "a\nb", '' ), $this->images->get_key( 'b', 'a' ) );
	}

	/**
	 * A saved image is a file in the plugin's directory, named here, and is
	 * listed in the post's meta with its size and theme.
	 */
	public function test_saves_an_image(): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$key  = $this->images->get_key( self::CODE );
		$png  = $this->png( 600, 300 );
		$file = sprintf( 'mermaid-blocks/%d-%s-auto.png', $post->ID, $key );

		$image = $this->images->save( $post, $key, 'auto', $png );

		$this->assertSame(
			array(
				'file'   => $file,
				'width'  => 600,
				'height' => 300,
				'theme'  => 'auto',
			),
			$image
		);
		$this->assertSame( $png, file_get_contents( $this->get_upload_path( $file ) ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- A local file.
		$this->assertSame( array( $key => $image ), get_post_meta( $post->ID, SavedImages::META_KEY, true ) );
		$this->assertSame( array( $key => $image ), $this->images->get_all( $post->ID ) );
	}

	/**
	 * A diagram finds its image by its code and theme, with the size to show
	 * it at: an image holds twice the pixels.
	 */
	public function test_finds_the_image_of_a_diagram(): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$this->images->save( $post, $this->images->get_key( self::CODE ), 'auto', $this->png( 601, 300 ) );

		$uploads = wp_get_upload_dir();

		$this->assertSame(
			array(
				'url'    => sprintf( '%s/mermaid-blocks/%d-%s-auto.png', $uploads['baseurl'], $post->ID, $this->images->get_key( self::CODE ) ),
				'width'  => 301,
				'height' => 150,
			),
			$this->images->find( $post->ID, self::CODE )
		);
	}

	/**
	 * A diagram whose code or theme changed finds no image: the one that was
	 * saved is of something else. Nor does a diagram in another post, or in
	 * none.
	 */
	public function test_finds_no_image_for_a_diagram_that_changed(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$other = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$this->images->save( $post, $this->images->get_key( self::CODE ), 'auto', $this->png() );

		$this->assertNull( $this->images->find( $post->ID, self::CODE . "\nB --> C" ) );
		$this->assertNull( $this->images->find( $post->ID, self::CODE, 'forest' ) );
		$this->assertNull( $this->images->find( $other->ID, self::CODE ) );
		$this->assertNull( $this->images->find( false, self::CODE ) );
		$this->assertNull( $this->images->find( 0, self::CODE ) );
	}

	/**
	 * Off, which is what the setting is until it is switched on, no image is
	 * found, though the ones saved before stay.
	 */
	public function test_finds_no_image_while_the_setting_is_off(): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$this->images->save( $post, $this->images->get_key( self::CODE ), 'auto', $this->png() );

		update_option( SavedImages::OPTION, 0 );
		$this->assertFalse( $this->images->is_on() );
		$this->assertNull( $this->images->find( $post->ID, self::CODE ) );

		delete_option( SavedImages::OPTION );
		$this->assertFalse( $this->images->is_on() );
		$this->assertNull( $this->images->find( $post->ID, self::CODE ) );

		update_option( SavedImages::OPTION, 1 );
		$this->assertNotNull( $this->images->find( $post->ID, self::CODE ) );
	}

	/**
	 * What isn't a PNG file.
	 *
	 * @return array[] The content of a file.
	 */
	public function data_no_png(): array {
		return array(
			'nothing'                    => array( '' ),
			'text'                       => array( 'graph TD' ),
			'markup'                     => array( '<img src=x onerror=alert(1)>' ),
			'an SVG'                     => array( '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' ),
			'PHP'                        => array( '<?php phpinfo();' ),
			'a GIF'                      => array( base64_decode( 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' ) ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- A GIF file.
			'a GIF that starts as a PNG' => array( SavedImages::SIGNATURE . base64_decode( 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' ) ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- A GIF file.
			'the start of a PNG'         => array( SavedImages::SIGNATURE ),
			'a PNG after something else' => array( '<?php ?>' . $this->png() ),
		);
	}

	/**
	 * Only a PNG file is saved, whatever was sent.
	 *
	 * @dataProvider data_no_png
	 *
	 * @param string $content The content of the file.
	 */
	public function test_refuses_what_is_no_png( string $content ): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );

		$result = $this->images->save( $post, $this->images->get_key( self::CODE ), 'auto', $content );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'mermaid_blocks_image_invalid', $result->get_error_code() );
		$this->assertSame( 400, $result->get_error_data()['status'] );
		$this->assertSame( array(), $this->images->get_all( $post->ID ) );
		$this->assertSame( array(), glob( $this->get_upload_path( 'mermaid-blocks/*' ) ) );
	}

	/**
	 * An image larger than a browser draws, or than is worth keeping, is
	 * refused.
	 */
	public function test_refuses_an_image_that_is_too_large(): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$key  = $this->images->get_key( self::CODE );

		$files = array(
			'too wide'       => $this->png( SavedImages::MAX_SIDE + 1, 1 ),
			'too high'       => $this->png( 1, SavedImages::MAX_SIDE + 1 ),
			'too many bytes' => $this->png() . str_repeat( 'x', SavedImages::MAX_BYTES ),
		);

		foreach ( $files as $name => $png ) {
			$result = $this->images->save( $post, $key, 'auto', $png );

			$this->assertInstanceOf( WP_Error::class, $result, $name );
			$this->assertSame( 'mermaid_blocks_image_too_large', $result->get_error_code(), $name );
			$this->assertSame( 413, $result->get_error_data()['status'], $name );
		}

		$this->assertSame( array(), $this->images->get_all( $post->ID ) );
		$this->assertIsArray( $this->images->save( $post, $key, 'auto', $this->png( SavedImages::MAX_SIDE, 1 ) ) );
	}

	/**
	 * The key and the theme become part of the file's name, and never a path.
	 */
	public function test_names_the_file_itself(): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$key  = $this->images->get_key( self::CODE );

		foreach ( array( '../../evil', 'ABCDEF', $key . '.php', '' ) as $bad_key ) {
			$result = $this->images->save( $post, $bad_key, 'auto', $this->png() );

			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 'mermaid_blocks_image_invalid', $result->get_error_code() );
		}

		$image = $this->images->save( $post, $key, '../../Evil theme.php', $this->png() );

		$this->assertSame( sprintf( 'mermaid-blocks/%d-%s-evilthemephp.png', $post->ID, $key ), $image['file'] );
		$this->assertFileExists( $this->get_upload_path( $image['file'] ) );
	}

	/**
	 * An image saved again for the same diagram, in another theme, replaces
	 * the one before it, under another name.
	 */
	public function test_replaces_the_image_of_a_diagram(): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$key  = $this->images->get_key( self::CODE );

		$first  = $this->images->save( $post, $key, 'auto', $this->png( 600, 300 ) );
		$second = $this->images->save( $post, $key, 'forest', $this->png( 400, 200 ) );

		$this->assertNotSame( $first['file'], $second['file'] );
		$this->assertFileDoesNotExist( $this->get_upload_path( $first['file'] ) );
		$this->assertFileExists( $this->get_upload_path( $second['file'] ) );
		$this->assertSame( array( $key => $second ), $this->images->get_all( $post->ID ) );
		$this->assertSame( 200, $this->images->find( $post->ID, self::CODE )['width'] );
	}

	/**
	 * Forgetting images removes their files and their entries, and the field
	 * with the last one.
	 */
	public function test_forgets_images(): void {
		$post   = $this->create_post( array( $this->diagram_block( 'pie' ), $this->diagram_block( 'gantt' ) ) );
		$pie    = $this->images->save( $post, $this->images->get_key( 'pie' ), 'auto', $this->png() );
		$gantt  = $this->images->save( $post, $this->images->get_key( 'gantt' ), 'auto', $this->png() );
		$nobody = $this->images->get_key( 'nobody' );

		$this->images->forget( $post->ID, array( $this->images->get_key( 'pie' ), $nobody ) );

		$this->assertFileDoesNotExist( $this->get_upload_path( $pie['file'] ) );
		$this->assertFileExists( $this->get_upload_path( $gantt['file'] ) );
		$this->assertSame( array( $this->images->get_key( 'gantt' ) => $gantt ), $this->images->get_all( $post->ID ) );

		$this->images->forget( $post->ID, array( $this->images->get_key( 'gantt' ) ) );

		$this->assertFileDoesNotExist( $this->get_upload_path( $gantt['file'] ) );
		$this->assertFalse( metadata_exists( 'post', $post->ID, SavedImages::META_KEY ) );
	}

	/**
	 * Deleting a post deletes its images, and no other post's.
	 */
	public function test_deletes_the_images_of_a_deleted_post(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$other = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$key   = $this->images->get_key( self::CODE );
		$image = $this->images->save( $post, $key, 'auto', $this->png() );
		$kept  = $this->images->save( $other, $key, 'auto', $this->png() );

		wp_delete_post( $post->ID, true );

		$this->assertFileDoesNotExist( $this->get_upload_path( $image['file'] ) );
		$this->assertFileExists( $this->get_upload_path( $kept['file'] ) );
	}

	/**
	 * The field may hold what this class never wrote, after an import for
	 * example. Such an entry names no image: its file is neither shown nor
	 * deleted.
	 */
	public function test_ignores_entries_it_did_not_write(): void {
		$post = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$key  = $this->images->get_key( self::CODE );

		wp_mkdir_p( $this->get_upload_path( 'mermaid-blocks/deeper' ) );
		$files = array( 'outside.png', 'mermaid-blocks/deeper/inside.png', 'mermaid-blocks/notes.txt' );
		foreach ( $files as $file ) {
			file_put_contents( $this->get_upload_path( $file ), 'kept' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- A file of the test.
		}

		$entry = static function ( $file ) {
			return array(
				'file'   => $file,
				'width'  => 10,
				'height' => 10,
				'theme'  => 'auto',
			);
		};

		// The file of another key, of another post, and one with a second extension.
		$others = array(
			sprintf( 'mermaid-blocks/%d-%s-auto.png', $post->ID, $key ),
			sprintf( 'mermaid-blocks/%d-%s-auto.png', $post->ID + 1, $this->images->get_key( 'i' ) ),
			sprintf( 'mermaid-blocks/%d-%s-auto.php.png', $post->ID, $this->images->get_key( 'j' ) ),
		);

		update_post_meta(
			$post->ID,
			SavedImages::META_KEY,
			array(
				$key                          => $entry( 'mermaid-blocks/../outside.png' ),
				$this->images->get_key( 'h' ) => $entry( $others[0] ),
				$this->images->get_key( 'i' ) => $entry( $others[1] ),
				$this->images->get_key( 'j' ) => $entry( $others[2] ),
				$this->images->get_key( 'a' ) => $entry( 'outside.png' ),
				$this->images->get_key( 'b' ) => $entry( 'mermaid-blocks/deeper/inside.png' ),
				$this->images->get_key( 'c' ) => $entry( 'mermaid-blocks/notes.txt' ),
				$this->images->get_key( 'd' ) => $entry( 'https://example.com/mermaid-blocks/x.png' ),
				$this->images->get_key( 'e' ) => $entry( array( 'mermaid-blocks/x.png' ) ),
				$this->images->get_key( 'f' ) => 'mermaid-blocks/x.png',
				$this->images->get_key( 'g' ) => array( 'file' => 'mermaid-blocks/x.png' ),
				'not-a-key'                   => $entry( 'mermaid-blocks/x.png' ),
				7                             => $entry( 'mermaid-blocks/x.png' ),
			)
		);

		$this->assertSame( array(), $this->images->get_all( $post->ID ) );
		$this->assertNull( $this->images->find( $post->ID, self::CODE ) );

		$this->images->delete_all( $post->ID );
		wp_delete_post( $post->ID, true );

		foreach ( $files as $file ) {
			$this->assertFileExists( $this->get_upload_path( $file ), $file );
		}

		update_post_meta( $post->ID, SavedImages::META_KEY, 'mermaid-blocks/x.png' );
		$this->assertSame( array(), $this->images->get_all( $post->ID ) );

		// Files are removed after each test, directories are not.
		wp_delete_file( $this->get_upload_path( 'mermaid-blocks/deeper/inside.png' ) );
		rmdir( $this->get_upload_path( 'mermaid-blocks/deeper' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- A directory of the test.
	}

	/**
	 * A copy of a post, made with its meta, doesn't have the images of the
	 * post it was copied from: it gets its own, and changing it leaves the
	 * files of the first post alone.
	 */
	public function test_leaves_the_images_of_the_post_a_copy_was_made_from(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$key   = $this->images->get_key( self::CODE );
		$image = $this->images->save( $post, $key, 'auto', $this->png() );

		$copy = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		update_post_meta( $copy->ID, SavedImages::META_KEY, get_post_meta( $post->ID, SavedImages::META_KEY, true ) );

		$this->assertSame( array(), $this->images->get_all( $copy->ID ) );
		$this->assertNull( $this->images->find( $copy->ID, self::CODE ) );

		$this->images->forget( $copy->ID, array( $key ) );
		$this->images->delete_all( $copy->ID );
		wp_update_post(
			array(
				'ID'           => $copy->ID,
				'post_content' => '',
			)
		);
		wp_delete_post( $copy->ID, true );

		$this->assertFileExists( $this->get_upload_path( $image['file'] ) );
		$this->assertNotNull( $this->images->find( $post->ID, self::CODE ) );

		$own = $this->images->save( $this->create_post( array( $this->diagram_block( self::CODE ) ) ), $key, 'auto', $this->png() );

		$this->assertNotSame( $image['file'], $own['file'] );
	}

	/**
	 * An image knows whether its file is still there.
	 */
	public function test_tells_whether_an_image_has_its_file(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$image = $this->images->save( $post, $this->images->get_key( self::CODE ), 'auto', $this->png() );

		$this->assertTrue( $this->images->has_file( $image ) );

		wp_delete_file( $this->get_upload_path( $image['file'] ) );

		$this->assertFalse( $this->images->has_file( $image ) );
	}

	/**
	 * The image takes the place of the source in feeds, and wherever the
	 * filter says so.
	 */
	public function test_replaces_the_source_in_feeds(): void {
		$this->assertFalse( $this->images->replaces_source() );

		$this->go_to( '/?feed=rss2' );
		$this->assertTrue( is_feed() );
		$this->assertTrue( $this->images->replaces_source() );

		add_filter( 'mermaid_blocks_image_replaces_source', '__return_false' );
		$this->assertFalse( $this->images->replaces_source() );
	}

	/**
	 * The setting is a switch on the settings page, which is off.
	 */
	public function test_adds_its_switch_to_the_settings_page(): void {
		global $wp_settings_sections, $wp_settings_fields;

		require_once ABSPATH . 'wp-admin/includes/template.php';

		delete_option( SavedImages::OPTION );
		mermaid_blocks()->settings()->register();

		$this->assertArrayHasKey( SavedImages::OPTION, get_registered_settings() );
		$this->assertArrayHasKey( SavedImages::OPTION, $wp_settings_fields[ Settings::PAGE ][ Settings::SECTION ] );
		$this->assertFalse( $this->images->is_on() );

		foreach ( get_registered_settings() as $option => $setting ) {
			if ( Settings::GROUP === $setting['group'] ) {
				unregister_setting( Settings::GROUP, $option );
			}
		}
		unset( $wp_settings_sections[ Settings::PAGE ], $wp_settings_fields[ Settings::PAGE ] );
	}

	/**
	 * Deleting the plugin deletes the setting, the images and what lists
	 * them, and leaves the files of others where they are.
	 */
	public function test_uninstall_deletes_the_images(): void {
		$post  = $this->create_post( array( $this->diagram_block( self::CODE ) ) );
		$image = $this->images->save( $post, $this->images->get_key( self::CODE ), 'auto', $this->png() );

		file_put_contents( $this->get_upload_path( 'outside.png' ), 'kept' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- A file of the test.

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'mermaid-blocks/mermaid-blocks.php' );
		}

		require dirname( __DIR__ ) . '/uninstall.php';

		$this->assertFalse( get_option( SavedImages::OPTION ) );
		$this->assertFalse( metadata_exists( 'post', $post->ID, SavedImages::META_KEY ) );
		$this->assertFileDoesNotExist( $this->get_upload_path( $image['file'] ) );
		$this->assertDirectoryDoesNotExist( $this->get_upload_path( 'mermaid-blocks' ) );
		$this->assertFileExists( $this->get_upload_path( 'outside.png' ) );
	}
}
