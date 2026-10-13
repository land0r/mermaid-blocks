<?php
/**
 * Tests of the abilities.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Abilities\Ability;
use MermaidBlocks\Abilities\Registrar;
use WP_Ability;
use WP_UnitTestCase;

/**
 * The abilities, run as WordPress runs them: input validated against the
 * schema, permission checked, output validated.
 *
 * @covers \MermaidBlocks\Abilities\Registrar
 * @covers \MermaidBlocks\Abilities\Ability
 * @covers \MermaidBlocks\Abilities\DiagramAbility
 * @covers \MermaidBlocks\Abilities\PostAbility
 * @covers \MermaidBlocks\Abilities\ListDiagramTypes
 * @covers \MermaidBlocks\Abilities\ListDiagrams
 * @covers \MermaidBlocks\Abilities\GetDiagram
 * @covers \MermaidBlocks\Abilities\BuildBlockMarkup
 * @covers \MermaidBlocks\Abilities\InsertDiagram
 * @covers \MermaidBlocks\Abilities\UpdateDiagram
 * @covers \MermaidBlocks\Abilities\DeleteDiagram
 */
class AbilitiesTest extends WP_UnitTestCase {

	/**
	 * An editor, an author, a contributor and a subscriber.
	 *
	 * @var int[]
	 */
	private static array $users;

	/**
	 * Creates the users.
	 *
	 * @param \WP_UnitTest_Factory $factory The factory.
	 */
	public static function wpSetUpBeforeClass( $factory ): void {
		foreach ( array( 'editor', 'author', 'contributor', 'subscriber' ) as $role ) {
			self::$users[ $role ] = $factory->user->create( array( 'role' => $role ) );
		}
	}

	/**
	 * Runs an ability as a user.
	 *
	 * @param string $name  The name of the ability, without the namespace.
	 * @param mixed  $input The input.
	 * @param string $role  The role of the user, or `visitor` for none.
	 *
	 * @return mixed The output, or the error.
	 */
	private function run_ability( string $name, $input = null, string $role = 'editor' ) {
		wp_set_current_user( 'visitor' === $role ? 0 : self::$users[ $role ] );

		return wp_get_ability( 'mermaid-blocks/' . $name )->execute( $input );
	}

	/**
	 * Creates a post with one diagram.
	 *
	 * @param string $role   The role of the post's author.
	 * @param string $status The status of the post.
	 *
	 * @return int The ID of the post.
	 */
	private function create_post( string $role = 'editor', string $status = 'publish' ): int {
		// Saved as an editor, whose markup kses leaves alone.
		wp_set_current_user( self::$users['editor'] );

		return self::factory()->post->create(
			array(
				'post_author'  => self::$users[ $role ],
				'post_status'  => $status,
				'post_content' => wp_slash(
					"<!-- wp:paragraph -->\n<p>Intro</p>\n<!-- /wp:paragraph -->\n\n"
					. '<!-- wp:mermaid-blocks/diagram {"code":"graph TD\nA --> B","zoom":true} /-->'
				),
			)
		);
	}

	/**
	 * Asserts that a result is an error with a code.
	 *
	 * @param string $code   The code.
	 * @param mixed  $result The result.
	 */
	private function assertErrorCode( string $code, $result ): void {
		$this->assertWPError( $result );
		$this->assertSame( $code, $result->get_error_code() );
	}

	/**
	 * Every ability is registered in the category, with its annotations, and
	 * shown in the REST API.
	 *
	 * @dataProvider data_annotations
	 *
	 * @param string $name        The name of the ability, without the namespace.
	 * @param bool   $is_readonly    Whether it changes nothing.
	 * @param bool   $is_destructive Whether it may remove something.
	 * @param bool   $is_idempotent  Whether running it again changes nothing more.
	 */
	public function test_registers_the_ability( string $name, bool $is_readonly, bool $is_destructive, bool $is_idempotent ): void {
		$ability = wp_get_ability( 'mermaid-blocks/' . $name );

		$this->assertInstanceOf( WP_Ability::class, $ability );
		$this->assertSame( 'mermaid-blocks', $ability->get_category() );
		$this->assertNotEmpty( $ability->get_label() );
		$this->assertNotEmpty( $ability->get_description() );
		$this->assertNotEmpty( $ability->get_output_schema() );
		$this->assertTrue( $ability->get_meta_item( 'show_in_rest' ) );
		$this->assertSame(
			array(
				'readonly'    => $is_readonly,
				'destructive' => $is_destructive,
				'idempotent'  => $is_idempotent,
			),
			$ability->get_meta_item( 'annotations' )
		);
	}

	/**
	 * The abilities, and their annotations.
	 *
	 * @return array[] The cases.
	 */
	public function data_annotations(): array {
		return array(
			array( 'list-diagram-types', true, false, true ),
			array( 'list-diagrams', true, false, true ),
			array( 'get-diagram', true, false, true ),
			array( 'build-block-markup', true, false, true ),
			array( 'insert-diagram', false, false, false ),
			array( 'update-diagram', false, false, true ),
			array( 'delete-diagram', false, true, true ),
		);
	}

	/**
	 * The registrar creates an ability of each class it lists, by name, and
	 * those are what WordPress has.
	 */
	public function test_creates_the_abilities_it_lists(): void {
		$registrar = mermaid_blocks()->get( Registrar::class );
		$abilities = $registrar->get_abilities();

		$this->assertSame( array_column( $this->data_annotations(), 0 ), str_replace( 'mermaid-blocks/', '', array_keys( $abilities ) ) );
		$this->assertSame( Registrar::ABILITIES, array_values( array_map( 'get_class', $abilities ) ) );
		$this->assertSame( $abilities, $registrar->get_abilities() );

		foreach ( $abilities as $name => $ability ) {
			$this->assertInstanceOf( Ability::class, $ability );
			$this->assertSame( $name, $ability->get_name() );
			$this->assertSame( $ability->get_args( Registrar::CATEGORY )['label'], wp_get_ability( $name )->get_label() );
		}
	}

	/**
	 * The category is registered.
	 */
	public function test_registers_the_category(): void {
		$this->assertTrue( wp_has_ability_category( 'mermaid-blocks' ) );
	}

	/**
	 * The diagram types come with their code.
	 */
	public function test_lists_the_diagram_types(): void {
		$types = $this->run_ability( 'list-diagram-types' );

		$this->assertSame( array( 'class-diagram', 'flowchart', 'mindmap', 'sequence-diagram', 'state-diagram' ), wp_list_pluck( $types, 'name' ) );
		$this->assertStringStartsWith( 'flowchart', $types[1]['code'] );
	}

	/**
	 * Those who can't write posts can't list the types.
	 */
	public function test_subscribers_cannot_list_the_diagram_types(): void {
		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( 'list-diagram-types', null, 'subscriber' ) );
	}

	/**
	 * Block markup parses back into the same diagram.
	 */
	public function test_builds_block_markup(): void {
		$output = $this->run_ability(
			'build-block-markup',
			array(
				'code'       => 'sequenceDiagram',
				'attributes' => array(
					'caption' => 'Hello',
					'theme'   => 'dark',
				),
			)
		);

		$this->assertSame( 'sequenceDiagram', $output['type'] );
		$this->assertFalse( $output['validated'] );
		$this->assertEquals(
			array(
				'code'    => 'sequenceDiagram',
				'theme'   => 'dark',
				'caption' => 'Hello',
			),
			parse_blocks( $output['markup'] )[0]['attrs']
		);
	}

	/**
	 * Input that doesn't match the schema is rejected.
	 *
	 * @dataProvider data_invalid_input
	 *
	 * @param string $name  The name of the ability, without the namespace.
	 * @param array  $input The input.
	 */
	public function test_rejects_invalid_input( string $name, array $input ): void {
		$this->assertErrorCode( 'ability_invalid_input', $this->run_ability( $name, $input ) );
	}

	/**
	 * Abilities, and input they reject.
	 *
	 * @return array[] The cases.
	 */
	public function data_invalid_input(): array {
		return array(
			'no code'           => array( 'build-block-markup', array() ),
			'unknown theme'     => array(
				'build-block-markup',
				array(
					'code'       => 'pie',
					'attributes' => array( 'theme' => 'pink' ),
				),
			),
			'unknown attribute' => array(
				'build-block-markup',
				array(
					'code'       => 'pie',
					'attributes' => array( 'onclick' => 'x' ),
				),
			),
			'no index'          => array( 'get-diagram', array( 'post_id' => 1 ) ),
			'negative index'    => array(
				'get-diagram',
				array(
					'post_id' => 1,
					'index'   => -1,
				),
			),
			'no hash'           => array(
				'delete-diagram',
				array(
					'post_id' => 1,
					'index'   => 0,
				),
			),
			'malformed hash'    => array(
				'update-diagram',
				array(
					'post_id' => 1,
					'index'   => 0,
					'hash'    => 'abc',
					'code'    => 'pie',
				),
			),
			'too many per page' => array( 'list-diagrams', array( 'per_page' => 500 ) ),
		);
	}

	/**
	 * A diagram of a post comes with its hash.
	 */
	public function test_gets_a_diagram(): void {
		$post_id = $this->create_post();
		$diagram = $this->run_ability(
			'get-diagram',
			array(
				'post_id' => $post_id,
				'index'   => 0,
			)
		);

		$this->assertSame( "graph TD\nA --> B", $diagram['code'] );
		$this->assertSame( 'graph', $diagram['type'] );
		$this->assertEquals( (object) array( 'zoom' => true ), $diagram['attributes'] );
	}

	/**
	 * Diagrams that aren't there, in posts that aren't there, are reported.
	 */
	public function test_reports_what_is_missing(): void {
		$post_id = $this->create_post();

		$this->assertErrorCode(
			'mermaid_blocks_diagram_not_found',
			$this->run_ability(
				'get-diagram',
				array(
					'post_id' => $post_id,
					'index'   => 1,
				)
			)
		);
		$this->assertErrorCode(
			'mermaid_blocks_post_not_found',
			$this->run_ability(
				'get-diagram',
				array(
					'post_id' => 99999,
					'index'   => 0,
				)
			)
		);
	}

	/**
	 * Only those who can edit a post read its diagrams: the code of a draft is
	 * no one else's to read.
	 */
	public function test_authors_cannot_read_diagrams_of_others(): void {
		$post_id = $this->create_post( 'editor', 'draft' );

		$this->assertErrorCode(
			'ability_invalid_permissions',
			$this->run_ability(
				'get-diagram',
				array(
					'post_id' => $post_id,
					'index'   => 0,
				),
				'author'
			)
		);
		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( 'list-diagrams', array( 'post_id' => $post_id ), 'author' ) );
	}

	/**
	 * Diagrams across posts are listed for the posts the user can edit.
	 */
	public function test_lists_the_diagrams_of_editable_posts(): void {
		$own    = $this->create_post( 'author', 'draft' );
		$others = $this->create_post( 'editor', 'draft' );
		self::factory()->post->create( array( 'post_content' => '<!-- wp:paragraph --><p>No diagram</p><!-- /wp:paragraph -->' ) );

		$for_author = $this->run_ability( 'list-diagrams', null, 'author' );
		$for_editor = $this->run_ability( 'list-diagrams', array( 'per_page' => 10 ) );

		$this->assertSame( array( $own ), wp_list_pluck( $for_author['posts'], 'id' ) );
		$this->assertEqualSets( array( $own, $others ), wp_list_pluck( $for_editor['posts'], 'id' ) );
		$this->assertSame( 2, $for_editor['total'] );
		$this->assertSame( "graph TD\nA --> B", $for_editor['posts'][0]['diagrams'][0]['code'] );
	}

	/**
	 * The diagrams of one post are listed.
	 */
	public function test_lists_the_diagrams_of_a_post(): void {
		$post_id = $this->create_post();
		$output  = $this->run_ability( 'list-diagrams', array( 'post_id' => $post_id ) );

		$this->assertSame( $post_id, $output['posts'][0]['id'] );
		$this->assertCount( 1, $output['posts'][0]['diagrams'] );
	}

	/**
	 * A diagram is added, and returned as it was saved.
	 */
	public function test_inserts_a_diagram(): void {
		$post_id = $this->create_post();
		$diagram = $this->run_ability(
			'insert-diagram',
			array(
				'post_id'    => $post_id,
				'code'       => 'pie',
				'attributes' => array( 'align' => 'wide' ),
				'position'   => 0,
			)
		);

		$this->assertSame( 0, $diagram['index'] );
		$this->assertSame( 'pie', $diagram['code'] );
		$this->assertEquals( (object) array( 'align' => 'wide' ), $diagram['attributes'] );
		$this->assertEquals(
			$diagram,
			$this->run_ability(
				'get-diagram',
				array(
					'post_id' => $post_id,
					'index'   => 0,
				)
			)
		);
	}

	/**
	 * Blank code is rejected.
	 */
	public function test_does_not_insert_blank_code(): void {
		$this->assertErrorCode(
			'mermaid_blocks_empty_code',
			$this->run_ability(
				'insert-diagram',
				array(
					'post_id' => $this->create_post(),
					'code'    => "  \n",
				)
			)
		);
	}

	/**
	 * Only those who can edit a post change its diagrams.
	 *
	 * @dataProvider data_write_abilities
	 *
	 * @param string $name The name of the ability, without the namespace.
	 */
	public function test_authors_cannot_change_posts_of_others( string $name ): void {
		$post_id = $this->create_post( 'editor' );
		$hash    = $this->run_ability(
			'get-diagram',
			array(
				'post_id' => $post_id,
				'index'   => 0,
			)
		)['hash'];
		$before  = get_post( $post_id )->post_content;
		$input   = array(
			'post_id' => $post_id,
			'index'   => 0,
			'hash'    => $hash,
			'code'    => 'pie',
		);

		if ( 'delete-diagram' === $name ) {
			unset( $input['code'] );
		}

		if ( 'insert-diagram' === $name ) {
			unset( $input['index'], $input['hash'] );
		}

		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( $name, $input, 'author' ) );
		$this->assertSame( $before, get_post( $post_id )->post_content );
	}

	/**
	 * The abilities that change posts.
	 *
	 * @return array[] The cases.
	 */
	public function data_write_abilities(): array {
		return array(
			array( 'insert-diagram' ),
			array( 'update-diagram' ),
			array( 'delete-diagram' ),
		);
	}

	/**
	 * An update changes what it names, and keeps the other attributes.
	 */
	public function test_updates_a_diagram(): void {
		$post_id = $this->create_post();
		$read    = $this->run_ability(
			'get-diagram',
			array(
				'post_id' => $post_id,
				'index'   => 0,
			)
		);
		$updated = $this->run_ability(
			'update-diagram',
			array(
				'post_id'    => $post_id,
				'index'      => 0,
				'hash'       => $read['hash'],
				'attributes' => array( 'caption' => 'Flow' ),
			)
		);

		$this->assertSame( "graph TD\nA --> B", $updated['code'] );
		$this->assertEquals(
			(object) array(
				'zoom'    => true,
				'caption' => 'Flow',
			),
			$updated['attributes']
		);
		$this->assertNotSame( $read['hash'], $updated['hash'] );
	}

	/**
	 * The same update again fails: the diagram changed since that hash.
	 */
	public function test_does_not_update_twice_with_the_same_hash(): void {
		$post_id = $this->create_post();
		$input   = array(
			'post_id' => $post_id,
			'index'   => 0,
			'hash'    => $this->run_ability(
				'get-diagram',
				array(
					'post_id' => $post_id,
					'index'   => 0,
				)
			)['hash'],
			'code'    => 'pie',
		);

		$this->assertIsArray( $this->run_ability( 'update-diagram', $input ) );
		$this->assertErrorCode( 'mermaid_blocks_diagram_changed', $this->run_ability( 'update-diagram', $input ) );
	}

	/**
	 * An update needs something to change.
	 */
	public function test_does_not_update_without_changes(): void {
		$post_id = $this->create_post();
		$hash    = $this->run_ability(
			'get-diagram',
			array(
				'post_id' => $post_id,
				'index'   => 0,
			)
		)['hash'];

		$this->assertErrorCode(
			'mermaid_blocks_nothing_to_update',
			$this->run_ability(
				'update-diagram',
				array(
					'post_id' => $post_id,
					'index'   => 0,
					'hash'    => $hash,
				)
			)
		);
	}

	/**
	 * A diagram is deleted, and the post keeps a revision with it.
	 */
	public function test_deletes_a_diagram(): void {
		$post_id = $this->create_post();
		$hash    = $this->run_ability(
			'get-diagram',
			array(
				'post_id' => $post_id,
				'index'   => 0,
			)
		)['hash'];
		$output  = $this->run_ability(
			'delete-diagram',
			array(
				'post_id' => $post_id,
				'index'   => 0,
				'hash'    => $hash,
			)
		);

		$this->assertSame(
			array(
				'post_id' => $post_id,
				'index'   => 0,
				'deleted' => true,
			),
			$output
		);
		$revisions = array_values( wp_get_post_revisions( $post_id ) );

		$this->assertStringNotContainsString( 'mermaid-blocks/diagram', get_post( $post_id )->post_content );
		$this->assertStringContainsString( 'mermaid-blocks/diagram', $revisions[1]->post_content );
	}

	/**
	 * Posts of types without content are refused.
	 */
	public function test_refuses_posts_without_content(): void {
		$attachment_id = self::factory()->attachment->create();

		$this->assertErrorCode(
			'mermaid_blocks_invalid_post_type',
			$this->run_ability(
				'get-diagram',
				array(
					'post_id' => $attachment_id,
					'index'   => 0,
				)
			)
		);
	}

	/**
	 * Returns input for an ability, about the diagram of a post.
	 *
	 * @param string $name    The name of the ability, without the namespace.
	 * @param int    $post_id The ID of the post.
	 *
	 * @return array|null The input.
	 */
	private function get_input( string $name, int $post_id ): ?array {
		// Read as an editor, who reaches every post.
		wp_set_current_user( self::$users['editor'] );

		$hash = wp_get_ability( 'mermaid-blocks/get-diagram' )->execute(
			array(
				'post_id' => $post_id,
				'index'   => 0,
			)
		);

		switch ( $name ) {
			case 'list-diagram-types':
				return null;
			case 'build-block-markup':
				return array( 'code' => 'pie' );
			case 'list-diagrams':
				return array( 'post_id' => $post_id );
			case 'get-diagram':
				return array(
					'post_id' => $post_id,
					'index'   => 0,
				);
			case 'insert-diagram':
				return array(
					'post_id' => $post_id,
					'code'    => 'pie',
				);
			case 'update-diagram':
				return array(
					'post_id' => $post_id,
					'index'   => 0,
					'hash'    => $hash['hash'],
					'code'    => 'pie',
				);
			default:
				return array(
					'post_id' => $post_id,
					'index'   => 0,
					'hash'    => $hash['hash'],
				);
		}
	}

	/**
	 * Subscribers and visitors run none of the abilities.
	 *
	 * @dataProvider data_abilities_for_outsiders
	 *
	 * @param string $name The name of the ability, without the namespace.
	 * @param string $role The role of the user, or `visitor`.
	 */
	public function test_outsiders_run_no_ability( string $name, string $role ): void {
		$post_id = $this->create_post();
		$input   = $this->get_input( $name, $post_id );
		$before  = get_post( $post_id )->post_content;

		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( $name, $input, $role ) );
		$this->assertSame( $before, get_post( $post_id )->post_content );
	}

	/**
	 * Every ability, for a subscriber and for a visitor.
	 *
	 * @return array[] The cases.
	 */
	public function data_abilities_for_outsiders(): array {
		$cases = array();

		foreach ( array( 'list-diagram-types', 'build-block-markup', 'list-diagrams', 'get-diagram', 'insert-diagram', 'update-diagram', 'delete-diagram' ) as $name ) {
			foreach ( array( 'subscriber', 'visitor' ) as $role ) {
				$cases[ "$name, $role" ] = array( $name, $role );
			}
		}

		return $cases;
	}

	/**
	 * Contributors work with the diagrams of their own drafts, as in the
	 * editor, and not once a post is published.
	 */
	public function test_contributors_reach_only_their_drafts(): void {
		$draft     = $this->create_post( 'contributor', 'draft' );
		$published = $this->create_post( 'contributor', 'publish' );
		$others    = $this->create_post( 'author', 'draft' );

		$this->assertIsArray( $this->run_ability( 'list-diagram-types', null, 'contributor' ) );
		$this->assertIsArray( $this->run_ability( 'insert-diagram', $this->get_input( 'insert-diagram', $draft ), 'contributor' ) );
		$this->assertIsArray( $this->run_ability( 'update-diagram', $this->get_input( 'update-diagram', $draft ), 'contributor' ) );
		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( 'insert-diagram', $this->get_input( 'insert-diagram', $published ), 'contributor' ) );
		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( 'get-diagram', $this->get_input( 'get-diagram', $others ), 'contributor' ) );
		$this->assertSame( array( $draft ), wp_list_pluck( $this->run_ability( 'list-diagrams', null, 'contributor' )['posts'], 'id' ) );
	}

	/**
	 * Authors work with the diagrams of their own posts, published ones
	 * included, and not with those of others.
	 */
	public function test_authors_reach_only_their_posts(): void {
		$own    = $this->create_post( 'author', 'publish' );
		$others = $this->create_post( 'editor', 'publish' );

		$this->assertIsArray( $this->run_ability( 'delete-diagram', $this->get_input( 'delete-diagram', $own ), 'author' ) );
		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( 'delete-diagram', $this->get_input( 'delete-diagram', $others ), 'author' ) );
		$this->assertErrorCode( 'ability_invalid_permissions', $this->run_ability( 'update-diagram', $this->get_input( 'update-diagram', $others ), 'author' ) );
	}

	/**
	 * Posts in the trash are left alone, as the editor leaves them.
	 */
	public function test_refuses_posts_in_the_trash(): void {
		$post_id = $this->create_post();
		$input   = $this->get_input( 'update-diagram', $post_id );

		wp_trash_post( $post_id );

		$this->assertErrorCode( 'mermaid_blocks_post_in_trash', $this->run_ability( 'update-diagram', $input ) );
	}

	/**
	 * Posts of types the block editor doesn't edit are refused, even for an
	 * administrator.
	 */
	public function test_refuses_post_types_outside_the_block_editor(): void {
		register_post_type(
			'mermaid_hidden',
			array(
				'show_in_rest' => false,
				'supports'     => array( 'editor' ),
			)
		);

		$post_id = self::factory()->post->create( array( 'post_type' => 'mermaid_hidden' ) );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$this->assertErrorCode(
			'mermaid_blocks_invalid_post_type',
			wp_get_ability( 'mermaid-blocks/insert-diagram' )->execute(
				array(
					'post_id' => $post_id,
					'code'    => 'pie',
				)
			)
		);

		unregister_post_type( 'mermaid_hidden' );
	}

	/**
	 * Every control for visitors can be switched on and off. A value that is
	 * not on or off is refused.
	 */
	public function test_sets_the_controls_of_a_diagram(): void {
		$post_id = $this->create_post();
		$diagram = $this->run_ability(
			'insert-diagram',
			array(
				'post_id'    => $post_id,
				'code'       => 'pie',
				'attributes' => array(
					'zoom'       => true,
					'download'   => true,
					'copy'       => true,
					'fullscreen' => true,
				),
			)
		);

		$this->assertEquals(
			(object) array(
				'zoom'       => true,
				'download'   => true,
				'copy'       => true,
				'fullscreen' => true,
			),
			$diagram['attributes']
		);

		$updated = $this->run_ability(
			'update-diagram',
			array(
				'post_id'    => $post_id,
				'index'      => $diagram['index'],
				'hash'       => $diagram['hash'],
				'attributes' => array(
					'copy'       => false,
					'fullscreen' => false,
				),
			)
		);

		$this->assertEquals(
			(object) array(
				'zoom'     => true,
				'download' => true,
			),
			$updated['attributes']
		);

		$this->assertErrorCode(
			'ability_invalid_input',
			$this->run_ability(
				'update-diagram',
				array(
					'post_id'    => $post_id,
					'index'      => $updated['index'],
					'hash'       => $updated['hash'],
					'attributes' => array( 'fullscreen' => 'always' ),
				)
			)
		);
	}
}
