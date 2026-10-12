<?php
/**
 * Tests of the diagram types.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\DiagramTypes;
use WP_UnitTestCase;

/**
 * The diagram types, their variations, and the detection of a type.
 *
 * @covers \MermaidBlocks\DiagramTypes
 */
class DiagramTypesTest extends WP_UnitTestCase {

	/**
	 * The diagram types.
	 *
	 * @var DiagramTypes
	 */
	private DiagramTypes $types;

	/**
	 * Creates the diagram types.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->types = new DiagramTypes();
	}

	/**
	 * Each type's code starts with its keyword.
	 */
	public function test_the_code_of_each_type_starts_with_its_keyword(): void {
		foreach ( $this->types->get_all() as $name => $type ) {
			$this->assertSame( $type['keyword'], $this->types->detect( $type['code'] ), $name );
		}
	}

	/**
	 * Each type has a title, a description, keywords and an icon.
	 */
	public function test_each_type_has_its_texts(): void {
		foreach ( $this->types->get_all() as $name => $type ) {
			foreach ( array( 'title', 'description', 'icon' ) as $key ) {
				$this->assertNotEmpty( $type[ $key ], "$name: $key" );
			}

			$this->assertNotEmpty( $type['keywords'], $name );
		}
	}

	/**
	 * There is a variation per type, offered when a diagram is transformed.
	 */
	public function test_there_is_a_variation_per_type(): void {
		$variations = $this->types->get_variations();

		$this->assertSame( array_keys( $this->types->get_all() ), wp_list_pluck( $variations, 'name' ) );

		foreach ( $variations as $variation ) {
			$this->assertSame( array( 'transform' ), $variation['scope'] );
			$this->assertSame( $this->types->get_all()[ $variation['name'] ]['code'], $variation['attributes']['code'] );
		}
	}

	/**
	 * The block gets the variations.
	 */
	public function test_the_block_has_the_variations(): void {
		$block_type = \WP_Block_Type_Registry::get_instance()->get_registered( 'mermaid-blocks/diagram' );

		$this->assertSame( $this->types->get_variations(), $block_type->get_variations() );
	}

	/**
	 * Detection skips what Mermaid skips before the first statement.
	 *
	 * @dataProvider data_detected_types
	 *
	 * @param string $code     The Mermaid source.
	 * @param string $expected The type.
	 */
	public function test_detects_the_type( string $code, string $expected ): void {
		$this->assertSame( $expected, $this->types->detect( $code ) );
	}

	/**
	 * Sources, and their types.
	 *
	 * @return array[] The cases.
	 */
	public function data_detected_types(): array {
		return array(
			'flowchart'         => array( "flowchart LR\nA --> B", 'flowchart' ),
			'graph'             => array( "graph TD\nA --> B", 'graph' ),
			'dashed keyword'    => array( "stateDiagram-v2\n[*] --> A", 'stateDiagram-v2' ),
			'leading blank'     => array( "\n\n   sequenceDiagram\nA->>B: Hi", 'sequenceDiagram' ),
			'front matter'      => array( "---\ntitle: Flow\nconfig:\n  theme: forest\n---\npie\n\"A\" : 1", 'pie' ),
			'directive'         => array( "%%{init: {\n  \"theme\": \"dark\" } }%%\ngantt\ntitle T", 'gantt' ),
			'comment'           => array( "%% A comment\nclassDiagram\nA <|-- B", 'classDiagram' ),
			'windows line ends' => array( "%% note\r\nerDiagram\r\nA ||--o{ B : has", 'erDiagram' ),
			'blank'             => array( "  \n\n", '' ),
			'only a comment'    => array( '%% nothing', '' ),
			'not a keyword'     => array( '--> A', '' ),
			'keyword and colon' => array( 'journey: x', 'journey' ),
			'beta keyword'      => array( "xychart-beta\nx-axis [a, b]", 'xychart-beta' ),
		);
	}
}
