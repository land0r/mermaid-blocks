<?php
/**
 * Tests of the block.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Block;
use WP_UnitTestCase;

/**
 * The markup the block renders on the server.
 *
 * @covers \MermaidBlocks\Block
 */
class BlockTest extends WP_UnitTestCase {

	/**
	 * Renders a diagram block.
	 *
	 * @param array $attributes The attributes of the block, besides its code.
	 *
	 * @return string The markup.
	 */
	private function render( array $attributes = array() ): string {
		return render_block(
			array(
				'blockName'    => Block::NAME,
				'attrs'        => array( 'code' => "graph TD\nA --> B" ) + $attributes,
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			)
		);
	}

	/**
	 * Attributes of the block, with the controls the diagram asks for.
	 *
	 * @return array[] The attributes and the controls, or null for none.
	 */
	public function data_controls(): array {
		return array(
			'none'              => array( array(), null ),
			'switched off'      => array(
				array(
					'zoom'       => false,
					'download'   => false,
					'copy'       => false,
					'fullscreen' => false,
				),
				null,
			),
			'zoom'              => array( array( 'zoom' => true ), 'zoom' ),
			'download'          => array( array( 'download' => true ), 'download' ),
			'copy'              => array( array( 'copy' => true ), 'copy' ),
			'fullscreen'        => array( array( 'fullscreen' => true ), 'fullscreen' ),
			'all, in one order' => array(
				array(
					'fullscreen' => true,
					'copy'       => true,
					'download'   => true,
					'zoom'       => true,
				),
				'zoom download copy fullscreen',
			),
		);
	}

	/**
	 * The diagram asks for the controls its attributes switch on, and for none
	 * otherwise: without the attribute, visitors get no controls.
	 *
	 * @dataProvider data_controls
	 *
	 * @param array       $attributes The attributes.
	 * @param string|null $controls   The controls.
	 */
	public function test_asks_for_the_controls( array $attributes, ?string $controls ): void {
		$markup = $this->render( $attributes );

		$this->assertStringContainsString( 'mermaid-blocks-diagram__source', $markup );

		if ( null === $controls ) {
			$this->assertStringNotContainsString( 'data-mermaid-controls', $markup );
		} else {
			$this->assertStringContainsString( ' data-mermaid-controls="' . $controls . '"', $markup );
		}
	}

	/**
	 * A block without code renders nothing.
	 */
	public function test_renders_nothing_without_code(): void {
		$this->assertSame(
			'',
			render_block(
				array(
					'blockName'    => Block::NAME,
					'attrs'        => array(
						'code'       => " \n",
						'fullscreen' => true,
					),
					'innerBlocks'  => array(),
					'innerHTML'    => '',
					'innerContent' => array(),
				)
			)
		);
	}
}
