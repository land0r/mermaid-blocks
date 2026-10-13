<?php
/**
 * Tests of the diagram markup.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Diagram;
use WP_UnitTestCase;

/**
 * The markup of a diagram, with and without a saved image.
 *
 * @covers \MermaidBlocks\Diagram
 */
class DiagramTest extends WP_UnitTestCase {

	/**
	 * The source of a diagram, as it is output.
	 */
	const SOURCE = '<pre class="mermaid-blocks-diagram__source">A&#91;x&#93; --&gt; B</pre>';

	/**
	 * The diagram markup.
	 *
	 * @var Diagram
	 */
	private Diagram $diagram;

	/**
	 * Gets the diagram markup.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->diagram = mermaid_blocks()->diagram();
	}

	/**
	 * Without an image, the wrapper holds the source, and the caption when
	 * there is one.
	 */
	public function test_wraps_the_source(): void {
		$this->assertSame(
			'<div class="mermaid-blocks-diagram">' . self::SOURCE . '</div>',
			$this->diagram->wrap( 'class="mermaid-blocks-diagram"', 'A[x] --> B' )
		);
		$this->assertSame(
			'<figure class="mermaid-blocks-diagram">' . self::SOURCE . '<figcaption class="mermaid-blocks-diagram__caption wp-element-caption">A caption</figcaption></figure>',
			$this->diagram->wrap( 'class="mermaid-blocks-diagram"', 'A[x] --> B', 'A caption', '', true )
		);
	}

	/**
	 * An image goes before the source, where only a browser that runs no
	 * JavaScript shows it, or in place of the source.
	 */
	public function test_wraps_the_image(): void {
		$image = '<img src="https://example.org/a.png" alt="Diagram" />';

		$this->assertSame(
			'<div class="mermaid-blocks-diagram has-image"><noscript>' . $image . '</noscript>' . self::SOURCE . '</div>',
			$this->diagram->wrap( 'class="mermaid-blocks-diagram has-image"', 'A[x] --> B', '', $image )
		);
		$this->assertSame(
			'<figure class="mermaid-blocks-diagram has-image">' . $image . '<figcaption class="mermaid-blocks-diagram__caption wp-element-caption">A caption</figcaption></figure>',
			$this->diagram->wrap( 'class="mermaid-blocks-diagram has-image"', 'A[x] --> B', 'A caption', $image, true )
		);
	}

	/**
	 * The image is an element with everything escaped, a size, and a text
	 * that says at least what it is.
	 */
	public function test_builds_the_image(): void {
		$image = array(
			'url'    => 'https://example.org/uploads/mermaid-blocks/a b"><script>.png',
			'width'  => '300',
			'height' => 150.7,
		);

		$this->assertSame(
			'<img class="mermaid-blocks-diagram__image" src="https://example.org/uploads/mermaid-blocks/a%20bscript.png" alt="Diagram" width="300" height="150" loading="lazy" decoding="async" />',
			$this->diagram->get_image_markup( $image, '  ' )
		);
		$this->assertStringContainsString( ' alt="&quot;&gt;&lt;script&gt; [gallery] &amp; more" ', $this->diagram->get_image_markup( $image, '"><script> [gallery] & more' ) );
	}

	/**
	 * The brackets of an image's text are encoded with the rest of the
	 * diagram, so no shortcode runs in it.
	 */
	public function test_keeps_shortcodes_out_of_the_image(): void {
		$image  = $this->diagram->get_image_markup(
			array(
				'url'    => 'https://example.org/a.png',
				'width'  => 1,
				'height' => 1,
			),
			'The [gallery] step'
		);
		$markup = do_shortcode( $this->diagram->wrap( 'class="mermaid-blocks-diagram has-image"', 'A --> B', '', $image ) );

		$this->assertStringContainsString( ' alt="The &#91;gallery&#93; step" ', $markup );
	}
}
