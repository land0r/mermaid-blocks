<?php
/**
 * Tests of the diagram markup.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use GraphDraw\Diagram;
use GraphDraw\Integrations\Shortcode;
use WP_UnitTestCase;

/**
 * The markup of a diagram, with and without a saved image.
 *
 * @covers \GraphDraw\Diagram
 */
class DiagramTest extends WP_UnitTestCase {

	/**
	 * The source of a diagram, as it is output.
	 */
	const SOURCE = '<pre class="graphdraw-diagram__source">A&#91;x&#93; --&gt; B</pre>';

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

		$this->diagram = graphdraw()->diagram();
	}

	/**
	 * Without an image, the wrapper holds the source, and the caption when
	 * there is one.
	 */
	public function test_wraps_the_source(): void {
		$this->assertSame(
			'<div class="graphdraw-diagram">' . self::SOURCE . '</div>',
			$this->diagram->wrap( 'class="graphdraw-diagram"', 'A[x] --> B' )
		);
		$this->assertSame(
			'<figure class="graphdraw-diagram">' . self::SOURCE . '<figcaption class="graphdraw-diagram__caption wp-element-caption">A caption</figcaption></figure>',
			$this->diagram->wrap( 'class="graphdraw-diagram"', 'A[x] --> B', 'A caption', '', true )
		);
	}

	/**
	 * An image goes before the source, where only a browser that runs no
	 * JavaScript shows it, or in place of the source.
	 */
	public function test_wraps_the_image(): void {
		$image = '<img src="https://example.org/a.png" alt="Diagram" />';

		$this->assertSame(
			'<div class="graphdraw-diagram has-image"><noscript>' . $image . '</noscript>' . self::SOURCE . '</div>',
			$this->diagram->wrap( 'class="graphdraw-diagram has-image"', 'A[x] --> B', '', $image )
		);
		$this->assertSame(
			'<figure class="graphdraw-diagram has-image">' . $image . '<figcaption class="graphdraw-diagram__caption wp-element-caption">A caption</figcaption></figure>',
			$this->diagram->wrap( 'class="graphdraw-diagram has-image"', 'A[x] --> B', 'A caption', $image, true )
		);
	}

	/**
	 * The image is an element with everything escaped, a size, and a text
	 * that says at least what it is.
	 */
	public function test_builds_the_image(): void {
		$image = array(
			'url'    => 'https://example.org/uploads/graphdraw/a b"><script>.png',
			'width'  => '300',
			'height' => 150.7,
		);

		$this->assertSame(
			'<img class="graphdraw-diagram__image" src="https://example.org/uploads/graphdraw/a%20bscript.png" alt="Diagram" width="300" height="150" loading="lazy" decoding="async" />',
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
		$markup = do_shortcode( $this->diagram->wrap( 'class="graphdraw-diagram has-image"', 'A --> B', '', $image ) );

		$this->assertStringContainsString( ' alt="The &#91;gallery&#93; step" ', $markup );
	}

	/**
	 * The controls, the title and the description of a diagram become the
	 * attributes the front-end script reads: only those that say something,
	 * with the texts trimmed.
	 */
	public function test_builds_the_attributes_the_script_reads(): void {
		$this->assertSame( array(), $this->diagram->get_data_attributes( array() ) );
		$this->assertSame( array(), $this->diagram->get_data_attributes( array(), ' ', null ) );
		$this->assertSame(
			array( 'data-mermaid-controls' => 'zoom download' ),
			$this->diagram->get_data_attributes( array( 'zoom', 'download' ) )
		);
		$this->assertSame(
			array(
				'data-mermaid-controls'    => 'copy',
				'data-mermaid-title'       => 'A title',
				'data-mermaid-description' => 'What it shows',
			),
			$this->diagram->get_data_attributes( array( 'copy' ), ' A title ', "What it shows\n" )
		);
		$this->assertSame(
			array( 'data-mermaid-description' => 'Only this' ),
			$this->diagram->get_data_attributes( array(), '', 'Only this' )
		);
	}

	/**
	 * An integration adds those attributes to the ones it passes with the
	 * code, and gets a diagram with the controls and the texts.
	 */
	public function test_takes_those_attributes_with_the_code(): void {
		$attributes = array( 'class' => 'alignwide' ) + $this->diagram->get_data_attributes( array( 'zoom', 'fullscreen' ), 'A "title"' );

		$this->assertSame(
			'<div class="graphdraw-diagram alignwide" data-mermaid-controls="zoom fullscreen" data-mermaid-title="A &quot;title&quot;" data-mermaid-theme="auto">' . self::SOURCE . '</div>',
			$this->diagram->get_markup( 'A[x] --> B', $attributes )
		);
	}

	/**
	 * The controls of settings named as the block's attributes: those that
	 * are on, in the order of CONTROLS, whatever the order of the settings.
	 */
	public function test_reads_the_controls_of_settings(): void {
		$this->assertSame( array(), $this->diagram->get_controls( array() ) );
		$this->assertSame(
			array( 'zoom', 'copy', 'fullscreen' ),
			$this->diagram->get_controls(
				array(
					'fullscreen' => 'yes',
					'download'   => '',
					'copy'       => true,
					'zoom'       => 1,
					'caption'    => 'Not a control',
				)
			)
		);
		$this->assertSame(
			array(),
			$this->diagram->get_controls(
				array(
					'zoom'     => false,
					'download' => '0',
				)
			)
		);
	}

	/**
	 * Settings named as the block's attributes, as a page builder widget has
	 * them, give the diagram the shortcode gives for the same settings.
	 */
	public function test_renders_settings_as_the_shortcode_does(): void {
		$code      = "flowchart LR\nA[\"Tom & Jerry\"] --> B{x < y}\nB --> C[gallery]";
		$shortcode = graphdraw()->get( Shortcode::class );

		// As WordPress calls it, with the code as the editors store it. Not through do_shortcode(), which decodes the brackets of its output.
		$this->assertSame(
			$shortcode->render(
				shortcode_parse_atts( 'theme="forest" zoom download caption="A <em>caption</em>" title="A &quot;title&quot;" description="What it shows" align="center"' ),
				esc_html( $code ),
				Shortcode::PREFIXED_TAG
			),
			$this->diagram->render(
				array(
					'code'     => $code,
					'theme'    => 'forest',
					'zoom'     => 'yes',
					'download' => 'yes',
					'copy'     => '',
					'caption'  => 'A <em>caption</em>',
					'accTitle' => 'A "title"',
					'accDescr' => 'What it shows',
					'align'    => 'center',
				)
			)
		);

		$this->assertSame(
			$shortcode->render( '', 'A[x] --&gt; B', Shortcode::PREFIXED_TAG ),
			$this->diagram->render( array( 'code' => 'A[x] --> B' ) )
		);
	}

	/**
	 * Each setting has its place in the markup. The controls the shortcode
	 * lacks, copy and fullscreen, are there too.
	 */
	public function test_renders_settings(): void {
		$markup = $this->diagram->render(
			array(
				'code'       => 'A[x] --> B',
				'theme'      => 'dark',
				'copy'       => 'yes',
				'fullscreen' => 'yes',
				'caption'    => 'Checkout',
				'align'      => 'wide',
				'widgetType' => 'ignored',
			)
		);

		$this->assertSame(
			'<figure class="graphdraw-diagram alignwide" data-mermaid-theme="dark" data-mermaid-controls="copy fullscreen">' . self::SOURCE . '<figcaption class="graphdraw-diagram__caption wp-element-caption">Checkout</figcaption></figure>',
			$markup
		);
	}

	/**
	 * Without code there is no diagram. An unknown theme or alignment is left
	 * out: the diagram gets the site's theme, and no alignment.
	 */
	public function test_renders_what_settings_allow(): void {
		$this->assertSame( '', $this->diagram->render( array() ) );
		$this->assertSame( '', $this->diagram->render( array( 'code' => " \n " ) ) );
		$this->assertSame(
			'<div data-mermaid-theme="auto" class="graphdraw-diagram">' . self::SOURCE . '</div>',
			$this->diagram->render(
				array(
					'code'  => 'A[x] --> B',
					'theme' => 'no-such-theme',
					'align' => 'left',
				)
			)
		);
	}
}
