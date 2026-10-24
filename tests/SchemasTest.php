<?php
/**
 * Tests of the schemas the abilities share.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Abilities\Schemas;
use MermaidBlocks\Options;
use MermaidBlocks\Posts\PostDiagrams;
use WP_UnitTestCase;

/**
 * The schema of the attributes of a diagram, made from the one list of them.
 *
 * @covers \MermaidBlocks\Abilities\Schemas
 */
class SchemasTest extends WP_UnitTestCase {

	/**
	 * The schemas.
	 *
	 * @var Schemas
	 */
	private Schemas $schemas;

	/**
	 * Gets the schemas.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->schemas = mermaid_blocks()->get( Schemas::class );
	}

	/**
	 * The schema has each attribute an ability may set, with the type the
	 * list gives it, and says what it is.
	 */
	public function test_describes_every_attribute(): void {
		$schema = $this->schemas->get_attributes();

		$this->assertSame( 'object', $schema['type'] );
		$this->assertFalse( $schema['additionalProperties'] );
		$this->assertSame( array_keys( PostDiagrams::ATTRIBUTES ), array_keys( $schema['properties'] ) );

		foreach ( PostDiagrams::ATTRIBUTES as $name => $type ) {
			$this->assertSame( $type, $schema['properties'][ $name ]['type'], $name );
			$this->assertNotEmpty( $schema['properties'][ $name ]['description'] ?? '', $name );
		}
	}

	/**
	 * A theme is one of the themes, or none, and an alignment one the block
	 * supports, or none.
	 */
	public function test_limits_the_theme_and_the_alignment(): void {
		$properties = $this->schemas->get_attributes()['properties'];

		$this->assertSame( array_merge( array( '' ), array_keys( mermaid_blocks()->themes()->get_all() ) ), $properties['theme']['enum'] );
		$this->assertSame( array( '', 'center', 'wide', 'full' ), $properties['align']['enum'] );
	}

	/**
	 * With Mermaid.js, which draws each theme and the colours in the code,
	 * the code and the theme say nothing of a renderer.
	 */
	public function test_says_nothing_of_pele_with_mermaid(): void {
		update_option( Options::RENDERER, 'mermaid' );

		$this->assertStringNotContainsString( 'Pele', $this->schemas->get_code()['description'] );
		$this->assertStringNotContainsString( 'Pele', $this->schemas->get_attributes()['properties']['theme']['description'] );
	}

	/**
	 * With Pele, the theme names the themes the site offers, and the code
	 * says its colours are ignored.
	 */
	public function test_says_what_pele_draws(): void {
		update_option( Options::RENDERER, 'pele' );

		$theme = $this->schemas->get_attributes()['properties']['theme']['description'];

		$this->assertStringContainsString( 'Pele, which draws every theme as light or dark', $theme );

		foreach ( array_keys( mermaid_blocks()->themes()->get_offered() ) as $name ) {
			$this->assertMatchesRegularExpression( '/\b' . $name . '\b/', $theme, $name );
		}

		$this->assertStringContainsString( 'themeVariables', $this->schemas->get_code()['description'] );
	}

	/**
	 * With Pele, every theme is still taken, so a diagram's attributes, as an
	 * ability returned them, can be passed back as they are.
	 */
	public function test_takes_every_theme_with_pele(): void {
		update_option( Options::RENDERER, 'pele' );

		$schema = $this->schemas->get_attributes();

		$this->assertSame( array_merge( array( '' ), array_keys( mermaid_blocks()->themes()->get_all() ) ), $schema['properties']['theme']['enum'] );
		$this->assertTrue( rest_validate_value_from_schema( array( 'theme' => 'forest' ), $schema ) );
	}

	/**
	 * Input the schema of the attributes takes, and input it refuses.
	 */
	public function test_validates_attributes(): void {
		$schema = $this->schemas->get_attributes();

		$this->assertTrue(
			rest_validate_value_from_schema(
				array(
					'theme' => 'dark',
					'zoom'  => true,
					'align' => '',
				),
				$schema
			)
		);
		$this->assertWPError( rest_validate_value_from_schema( array( 'theme' => 'no-such-theme' ), $schema ) );
		$this->assertWPError( rest_validate_value_from_schema( array( 'code' => 'pie' ), $schema ) );
	}

	/**
	 * What addresses a diagram: a post, an index from 0, and a hash.
	 */
	public function test_describes_what_addresses_a_diagram(): void {
		$this->assertSame( 'integer', $this->schemas->get_post_id()['type'] );
		$this->assertSame( 1, $this->schemas->get_post_id()['minimum'] );
		$this->assertSame( 0, $this->schemas->get_index()['minimum'] );
		$this->assertTrue( rest_validate_value_from_schema( md5( 'a' ), $this->schemas->get_hash() ) );
		$this->assertWPError( rest_validate_value_from_schema( 'not-a-hash', $this->schemas->get_hash() ) );
		$this->assertWPError( rest_validate_value_from_schema( '', $this->schemas->get_code() ) );
	}

	/**
	 * A diagram in the output has what PostDiagrams::describe() returns.
	 */
	public function test_describes_a_diagram_as_it_is_returned(): void {
		$post = self::factory()->post->create_and_get();

		$diagrams  = mermaid_blocks()->get( PostDiagrams::class );
		$described = $diagrams->describe( $post, 0, $diagrams->create_block( 'pie' ) );

		$this->assertSame( array_keys( $described ), array_keys( $this->schemas->get_diagram()['properties'] ) );
	}
}
