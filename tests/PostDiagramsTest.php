<?php
/**
 * Tests of the diagrams in posts.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use GraphDraw\Diagram;
use GraphDraw\DiagramTypes;
use GraphDraw\Integrations\Block;
use GraphDraw\Posts\PostDiagrams;
use WP_Block_Type_Registry;
use WP_Post;
use WP_UnitTestCase;

/**
 * Finding diagrams by index, and adding, changing and removing them.
 *
 * @covers \GraphDraw\Posts\PostDiagrams
 */
class PostDiagramsTest extends WP_UnitTestCase {

	/**
	 * The diagrams in posts.
	 *
	 * @var PostDiagrams
	 */
	private PostDiagrams $diagrams;

	/**
	 * Creates the diagrams, as an administrator, who may save any markup.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->diagrams = new PostDiagrams( new DiagramTypes() );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * Returns the markup of a diagram block.
	 *
	 * @param string $code       The code.
	 * @param array  $attributes Other attributes.
	 *
	 * @return string The markup.
	 */
	private function diagram( string $code, array $attributes = array() ): string {
		return serialize_block( $this->diagrams->create_block( $code, $attributes ) );
	}

	/**
	 * Creates a post.
	 *
	 * @param string $content The content.
	 *
	 * @return WP_Post The post.
	 */
	private function create_post( string $content ): WP_Post {
		return get_post( self::factory()->post->create( array( 'post_content' => wp_slash( $content ) ) ) );
	}

	/**
	 * Returns a post with two diagrams, the second in a group, between other
	 * blocks.
	 *
	 * @return WP_Post The post.
	 */
	private function create_post_with_diagrams(): WP_Post {
		return $this->create_post(
			implode(
				"\n\n",
				array(
					"<!-- wp:paragraph -->\n<p>Intro</p>\n<!-- /wp:paragraph -->",
					$this->diagram( 'graph TD', array( 'theme' => 'forest' ) ),
					"<!-- wp:group -->\n<div class=\"wp-block-group\">"
						. "<!-- wp:paragraph -->\n<p>In</p>\n<!-- /wp:paragraph -->\n\n"
						. $this->diagram( 'pie' )
						. "</div>\n<!-- /wp:group -->",
					"<!-- wp:paragraph -->\n<p>Outro</p>\n<!-- /wp:paragraph -->",
				)
			)
		);
	}

	/**
	 * Returns the codes of a post's diagrams, as it is saved now.
	 *
	 * @param int $post_id The ID of the post.
	 *
	 * @return string[] The codes, by index.
	 */
	private function get_codes( int $post_id ): array {
		return wp_list_pluck( wp_list_pluck( $this->diagrams->get_all( get_post( $post_id ) ), 'attrs' ), 'code' );
	}

	/**
	 * Diagrams are found in document order, nested ones included.
	 */
	public function test_finds_diagrams_in_document_order(): void {
		$post = $this->create_post_with_diagrams();

		$this->assertSame( array( 'graph TD', 'pie' ), $this->get_codes( $post->ID ) );
		$this->assertSame( 'pie', $this->diagrams->get( $post, 1 )['attrs']['code'] );
		$this->assertNull( $this->diagrams->get( $post, 2 ) );
	}

	/**
	 * A diagram is described with its address, hash, type and attributes.
	 */
	public function test_describes_a_diagram(): void {
		$post    = $this->create_post_with_diagrams();
		$block   = $this->diagrams->get( $post, 0 );
		$diagram = $this->diagrams->describe( $post, 0, $block );

		$this->assertSame( $post->ID, $diagram['post_id'] );
		$this->assertSame( 0, $diagram['index'] );
		$this->assertSame( 'graph TD', $diagram['code'] );
		$this->assertSame( 'graph', $diagram['type'] );
		$this->assertFalse( $diagram['validated'] );
		$this->assertEquals( (object) array( 'theme' => 'forest' ), $diagram['attributes'] );
		$this->assertMatchesRegularExpression( '/^[0-9a-f]{32}$/', $diagram['hash'] );
	}

	/**
	 * The hash changes with any attribute.
	 */
	public function test_the_hash_changes_with_any_attribute(): void {
		$block   = $this->diagrams->create_block( 'graph TD' );
		$changed = $this->diagrams->create_block( 'graph TD', array( 'caption' => 'A' ) );

		$this->assertSame( $this->diagrams->get_hash( $block ), $this->diagrams->get_hash( $this->diagrams->create_block( 'graph TD' ) ) );
		$this->assertNotSame( $this->diagrams->get_hash( $block ), $this->diagrams->get_hash( $changed ) );
	}

	/**
	 * Empty values remove attributes, unknown ones are ignored, and booleans
	 * and strings get their types.
	 */
	public function test_merges_attributes(): void {
		$merged = $this->diagrams->merge_attributes(
			array(
				'code'    => 'graph',
				'theme'   => 'dark',
				'caption' => 'Old',
				'zoom'    => true,
			),
			array(
				'theme'    => '',
				'caption'  => 'New',
				'zoom'     => 'false',
				'download' => '1',
				'unknown'  => 'x',
			)
		);

		$this->assertSame(
			array(
				'code'     => 'graph',
				'caption'  => 'New',
				'download' => true,
			),
			$merged
		);
	}

	/**
	 * A new diagram goes at the end by default, and gets the next index.
	 */
	public function test_inserts_at_the_end(): void {
		$post  = $this->create_post_with_diagrams();
		$index = $this->diagrams->insert( $post, $this->diagrams->create_block( 'gantt' ) );

		$this->assertSame( 2, $index );
		$this->assertSame( array( 'graph TD', 'pie', 'gantt' ), $this->get_codes( $post->ID ) );
		$this->assertStringEndsWith( "<!-- /wp:paragraph -->\n\n" . $this->diagram( 'gantt' ), get_post( $post->ID )->post_content );
	}

	/**
	 * A new diagram goes before the top-level block at its position, and its
	 * index counts the diagrams before it, nested ones included.
	 *
	 * @dataProvider data_positions
	 *
	 * @param int      $position The position.
	 * @param int      $index    The index of the new diagram.
	 * @param string[] $codes    The codes of the diagrams afterwards.
	 */
	public function test_inserts_at_a_position( int $position, int $index, array $codes ): void {
		$post = $this->create_post_with_diagrams();

		$this->assertSame( $index, $this->diagrams->insert( $post, $this->diagrams->create_block( 'gantt' ), $position ) );
		$this->assertSame( $codes, $this->get_codes( $post->ID ) );
	}

	/**
	 * Positions, with the index of the new diagram and the diagrams after.
	 *
	 * @return array[] The cases.
	 */
	public function data_positions(): array {
		return array(
			'first'        => array( 0, 0, array( 'gantt', 'graph TD', 'pie' ) ),
			'second'       => array( 1, 0, array( 'gantt', 'graph TD', 'pie' ) ),
			'after one'    => array( 2, 1, array( 'graph TD', 'gantt', 'pie' ) ),
			'after nested' => array( 3, 2, array( 'graph TD', 'pie', 'gantt' ) ),
			'past the end' => array( 9, 2, array( 'graph TD', 'pie', 'gantt' ) ),
		);
	}

	/**
	 * A diagram goes into an empty post on its own.
	 */
	public function test_inserts_into_an_empty_post(): void {
		$post = $this->create_post( '' );

		$this->assertSame( 0, $this->diagrams->insert( $post, $this->diagrams->create_block( 'pie' ) ) );
		$this->assertSame( $this->diagram( 'pie' ), get_post( $post->ID )->post_content );
	}

	/**
	 * A nested diagram is replaced in place, and the rest of the post stays
	 * as it was.
	 */
	public function test_replaces_a_nested_diagram(): void {
		$post   = $this->create_post_with_diagrams();
		$before = $post->post_content;
		$block  = $this->diagrams->get( $post, 1 );
		$new    = $this->diagrams->create_block( 'pie showData', array( 'caption' => 'Pets' ) );

		$this->assertTrue( $this->diagrams->replace( $post, 1, $this->diagrams->get_hash( $block ), $new ) );

		$after = get_post( $post->ID )->post_content;

		$this->assertSame( str_replace( $this->diagram( 'pie' ), serialize_block( $new ), $before ), $after );
		$this->assertSame( array( 'graph TD', 'pie showData' ), $this->get_codes( $post->ID ) );
	}

	/**
	 * A change based on an old hash fails, and changes nothing.
	 */
	public function test_does_not_overwrite_a_diagram_that_changed(): void {
		$post   = $this->create_post_with_diagrams();
		$before = $post->post_content;
		$hash   = $this->diagrams->get_hash( $this->diagrams->create_block( 'graph LR' ) );

		$replaced = $this->diagrams->replace( $post, 0, $hash, $this->diagrams->create_block( 'pie' ) );
		$removed  = $this->diagrams->remove( $post, 0, $hash );

		foreach ( array( $replaced, $removed ) as $error ) {
			$this->assertWPError( $error );
			$this->assertSame( 'graphdraw_diagram_changed', $error->get_error_code() );
			$this->assertSame( 409, $error->get_error_data()['status'] );
		}

		$this->assertSame( $before, get_post( $post->ID )->post_content );
	}

	/**
	 * A change to a diagram that isn't there fails.
	 */
	public function test_does_not_change_a_missing_diagram(): void {
		$post  = $this->create_post_with_diagrams();
		$error = $this->diagrams->remove( $post, 5, str_repeat( '0', 32 ) );

		$this->assertWPError( $error );
		$this->assertSame( 'graphdraw_diagram_not_found', $error->get_error_code() );
	}

	/**
	 * A nested diagram is removed with its place in the group's content, so
	 * the group still serializes as it parses.
	 */
	public function test_removes_a_nested_diagram(): void {
		$post  = $this->create_post_with_diagrams();
		$block = $this->diagrams->get( $post, 1 );

		$this->assertTrue( $this->diagrams->remove( $post, 1, $this->diagrams->get_hash( $block ) ) );

		$content = get_post( $post->ID )->post_content;
		$blocks  = parse_blocks( $content );

		$this->assertSame( array( 'graph TD' ), $this->get_codes( $post->ID ) );
		$this->assertSame( $content, serialize_blocks( $blocks ) );
		$this->assertStringContainsString( "<p>In</p>\n<!-- /wp:paragraph -->\n\n</div>", $content );
	}

	/**
	 * A top-level diagram is removed with the white space after it.
	 */
	public function test_removes_a_top_level_diagram(): void {
		$post  = $this->create_post_with_diagrams();
		$block = $this->diagrams->get( $post, 0 );

		$this->assertTrue( $this->diagrams->remove( $post, 0, $this->diagrams->get_hash( $block ) ) );
		$this->assertStringStartsWith( "<!-- wp:paragraph -->\n<p>Intro</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:group -->", get_post( $post->ID )->post_content );
	}

	/**
	 * Each change leaves a revision, and the first also keeps what the post
	 * was before, though it was never updated.
	 */
	public function test_each_change_leaves_a_revision(): void {
		$post     = $this->create_post_with_diagrams();
		$original = $post->post_content;

		$this->diagrams->insert( $post, $this->diagrams->create_block( 'gantt' ) );
		$post = get_post( $post->ID );
		$this->diagrams->remove( $post, 2, $this->diagrams->get_hash( $this->diagrams->get( $post, 2 ) ) );

		$revisions = array_values( wp_get_post_revisions( $post->ID ) );

		$this->assertCount( 3, $revisions );
		$this->assertSame( get_post( $post->ID )->post_content, $revisions[0]->post_content );
		$this->assertStringContainsString( 'gantt', $revisions[1]->post_content );
		$this->assertSame( $original, $revisions[2]->post_content );
	}

	/**
	 * Code with characters that block markup escapes comes back as it was.
	 */
	public function test_keeps_code_with_special_characters(): void {
		$code = "graph TD\n  A[\"<b>&amp; ' -- \\\\ \"] --> B{Yes?}";
		$post = $this->create_post( '' );

		$this->diagrams->insert( $post, $this->diagrams->create_block( $code ) );

		$this->assertSame( array( $code ), $this->get_codes( $post->ID ) );
	}

	/**
	 * The attributes of the controls are those of the block, so an ability can
	 * set every control the editor can.
	 */
	public function test_knows_every_control(): void {
		$block = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );

		foreach ( Diagram::CONTROLS as $control ) {
			$this->assertSame( 'boolean', PostDiagrams::ATTRIBUTES[ $control ] ?? null, $control );
			$this->assertSame( 'boolean', $block->attributes[ $control ]['type'] ?? null, $control );
			$this->assertFalse( $block->attributes[ $control ]['default'] ?? null, $control );
		}

		$attributes = array_fill_keys( Diagram::CONTROLS, true );

		$this->assertSame(
			array( 'code' => 'pie' ) + $attributes,
			$this->diagrams->create_block( 'pie', $attributes )['attrs']
		);
		$this->assertSame(
			array( 'code' => 'pie' ),
			$this->diagrams->merge_attributes( array( 'code' => 'pie' ) + $attributes, array_fill_keys( Diagram::CONTROLS, false ) )
		);
	}

	/**
	 * The attributes an ability may set are those the block declares, with
	 * their types: all but the code, which an ability takes on its own, and
	 * with the alignment, which the block has from its supports.
	 */
	public function test_lists_the_attributes_of_the_block(): void {
		$declared = wp_json_file_decode( dirname( __DIR__ ) . '/src/block.json', array( 'associative' => true ) )['attributes'];

		$this->assertArrayHasKey( 'code', $declared );
		unset( $declared['code'] );

		$expected = wp_list_pluck( $declared, 'type' ) + array( 'align' => 'string' );
		$listed   = PostDiagrams::ATTRIBUTES;

		ksort( $expected );
		ksort( $listed );

		$this->assertSame( $expected, $listed );

		// What WordPress registered from the build, the alignment included.
		$block = WP_Block_Type_Registry::get_instance()->get_registered( Block::NAME );

		foreach ( PostDiagrams::ATTRIBUTES as $name => $type ) {
			$this->assertSame( $type, $block->attributes[ $name ]['type'] ?? null, $name );
		}
	}
}
