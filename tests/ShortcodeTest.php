<?php
/**
 * Tests of the shortcode.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use GraphDraw\Assets;
use GraphDraw\Integrations\Shortcode;
use WP_UnitTestCase;

/**
 * The shortcode, run as WordPress runs it: in post content, with the filters
 * that change the content before a shortcode sees it.
 *
 * @covers \GraphDraw\Integrations\Shortcode
 */
class ShortcodeTest extends WP_UnitTestCase {

	/**
	 * A diagram with what the content filters get wrong: arrows, quotes,
	 * brackets, a blank line and indentation.
	 */
	const CODE = "flowchart LR\n  A[Start] --> B{\"It's fine?\"}\n\n  B -->|Yes| C[Done]";

	/**
	 * The shortcode.
	 *
	 * @var Shortcode
	 */
	private Shortcode $shortcode;

	/**
	 * Starts from a page without the assets.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->shortcode = graphdraw()->get( Shortcode::class );

		wp_dequeue_script( Assets::DIAGRAM );
		wp_dequeue_style( Assets::DIAGRAM );
	}

	/**
	 * Gives the tags back to the plugin: the list of shortcodes outlives a test.
	 */
	public function tear_down(): void {
		remove_shortcode( Shortcode::TAG );
		remove_shortcode( Shortcode::PREFIXED_TAG );
		$this->shortcode->register();

		parent::tear_down();
	}

	/**
	 * Returns the source in the markup of a diagram, as the browser reads it.
	 *
	 * @param string $markup The markup.
	 *
	 * @return string|null The source, or null when the markup has none.
	 */
	private function get_source( string $markup ): ?string {
		if ( ! preg_match( '#<pre class="graphdraw-diagram__source">(.*?)</pre>#s', $markup, $matches ) ) {
			return null;
		}

		return html_entity_decode( $matches[1], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}

	/**
	 * Returns the shortcode around some code.
	 *
	 * @param string $code       The code.
	 * @param string $attributes The attributes, as written in the tag.
	 * @param string $tag        The tag.
	 *
	 * @return string The shortcode.
	 */
	private function shortcode( string $code = self::CODE, string $attributes = '', string $tag = Shortcode::TAG ): string {
		return sprintf( "[%1\$s%2\$s]\n%3\$s\n[/%1\$s]", $tag, '' === $attributes ? '' : ' ' . $attributes, $code );
	}

	/**
	 * Both tags run the shortcode.
	 */
	public function test_registers_both_tags(): void {
		$this->assertTrue( shortcode_exists( 'mermaid' ) );
		$this->assertTrue( shortcode_exists( 'graphdraw' ) );
		$this->assertSame( array( 'mermaid', 'graphdraw' ), $this->shortcode->get_tags() );
	}

	/**
	 * The tags.
	 *
	 * @return array[] The tags.
	 */
	public function data_tags(): array {
		return array(
			'short'    => array( 'mermaid' ),
			'prefixed' => array( 'graphdraw' ),
		);
	}

	/**
	 * The shortcode outputs the markup of a diagram, and loads what renders it.
	 *
	 * @dataProvider data_tags
	 *
	 * @param string $tag The tag.
	 */
	public function test_renders_a_diagram( string $tag ): void {
		$markup = do_shortcode( $this->shortcode( self::CODE, '', $tag ) );

		$this->assertStringStartsWith( '<div class="graphdraw-diagram" data-mermaid-theme="', $markup );
		$this->assertSame( self::CODE, $this->get_source( $markup ) );
		$this->assertTrue( wp_script_is( Assets::DIAGRAM ) );
		$this->assertTrue( wp_style_is( Assets::DIAGRAM ) );
	}

	/**
	 * A shortcode without code outputs nothing, and loads nothing.
	 *
	 * @testWith ["[mermaid][/mermaid]"]
	 *           ["[mermaid]\n\n[/mermaid]"]
	 *           ["[mermaid]"]
	 *           ["[mermaid /]"]
	 *
	 * @param string $shortcode The shortcode.
	 */
	public function test_outputs_nothing_without_code( string $shortcode ): void {
		$this->assertSame( '', do_shortcode( $shortcode ) );
		$this->assertFalse( wp_script_is( Assets::DIAGRAM ) );
	}

	/**
	 * In post content the code comes through as written: wptexturize() leaves
	 * it alone, and what wpautop() added is taken out again.
	 */
	public function test_keeps_the_code_in_post_content(): void {
		$content = apply_filters( 'the_content', "Before.\n\n" . $this->shortcode() . "\n\nAfter." );

		$this->assertSame( self::CODE, $this->get_source( $content ) );
		$this->assertStringContainsString( '<p>Before.</p>', $content );
		$this->assertStringContainsString( '<p>After.</p>', $content );
	}

	/**
	 * The same in a Shortcode block, which runs wpautop() on its own.
	 */
	public function test_keeps_the_code_in_a_shortcode_block(): void {
		$content = apply_filters( 'the_content', "<!-- wp:shortcode -->\n" . $this->shortcode() . "\n<!-- /wp:shortcode -->" );

		$this->assertSame( self::CODE, $this->get_source( $content ) );
	}

	/**
	 * The same in a text widget.
	 */
	public function test_keeps_the_code_in_a_text_widget(): void {
		$content = apply_filters( 'widget_text_content', $this->shortcode() );

		$this->assertSame( self::CODE, $this->get_source( $content ) );
	}

	/**
	 * The same for an author, whose content is saved through kses: `>` is
	 * stored as an entity.
	 */
	public function test_keeps_the_code_an_author_saved(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		$post = get_post( self::factory()->post->create( array( 'post_content' => wp_slash( $this->shortcode() ) ) ) );

		$this->assertStringContainsString( '--&gt;', $post->post_content );
		$this->assertSame( self::CODE, $this->get_source( apply_filters( 'the_content', $post->post_content ) ) );
	}

	/**
	 * Diagrams with a `<` that no `>` follows before the shortcode closes, and
	 * with line breaks written as tags.
	 *
	 * @return array[] The code.
	 */
	public function data_code_with_brackets(): array {
		return array(
			'inheritance in a class diagram' => array( "classDiagram\nAnimal <|-- Duck\nAnimal <|-- Fish" ),
			'a comparison in the last label' => array( "flowchart LR\nA --> B\nB[x < y]" ),
			'an arrow both ways'             => array( "flowchart LR\nA <--> B\nB <--> C" ),
			'a line break ending a line'     => array( "flowchart LR\nA[\"one<br>\ntwo\"] --> B[three<br/>four]" ),
			'stereotypes'                    => array( "classDiagram\nclass Shape\n<<interface>> Shape" ),
		);
	}

	/**
	 * A `<` in the code is no start of a tag to the content filters, which
	 * would hide the closing tag of the shortcode in it.
	 *
	 * @dataProvider data_code_with_brackets
	 *
	 * @param string $code The code.
	 */
	public function test_keeps_code_with_brackets( string $code ): void {
		$shortcode = $this->shortcode( $code );
		$after     = "\n\nAfter <strong>the</strong> diagram.";

		$classic = apply_filters( 'the_content', $shortcode . $after );
		$block   = apply_filters( 'the_content', "<!-- wp:shortcode -->\n" . $shortcode . "\n<!-- /wp:shortcode -->\n\n<!-- wp:paragraph -->\n<p>After <strong>the</strong> diagram.</p>\n<!-- /wp:paragraph -->" );
		$widget  = apply_filters( 'widget_text_content', $shortcode . $after );

		$this->assertSame( $code, $this->get_source( $classic ) );
		$this->assertSame( $code, $this->get_source( $block ) );
		$this->assertSame( $code, $this->get_source( $widget ) );
		$this->assertStringContainsString( '<p>After <strong>the</strong> diagram.</p>', $classic );
		$this->assertStringContainsString( '>After <strong>the</strong> diagram.</p>', $block );
	}

	/**
	 * Only the code of this shortcode is protected: other content, another
	 * plugin's shortcode and a shortcode written as text stay as they are.
	 */
	public function test_protects_only_its_own_code(): void {
		add_shortcode( 'graphdraw_test', '__return_empty_string' );

		$other = "<p>1 < 2</p>\n[graphdraw_test]a < b[/graphdraw_test]\n[[mermaid]a < b[/mermaid]]\n[mermaid /]";

		$this->assertSame( $other, $this->shortcode->protect_code( $other ) );
		$this->assertSame(
			$other . "\n[mermaid zoom]a &lt;--&gt; b[/mermaid]\n[graphdraw]c &lt; d[/graphdraw]",
			$this->shortcode->protect_code( $other . "\n[mermaid zoom]a <--> b[/mermaid]\n[graphdraw]c < d[/graphdraw]" )
		);
		$this->assertNull( $this->shortcode->protect_code( null ) );

		remove_shortcode( 'graphdraw_test' );
	}

	/**
	 * The code of a tag another plugin has is left alone.
	 */
	public function test_protects_no_code_of_a_taken_tag(): void {
		add_shortcode( 'mermaid', '__return_empty_string' );

		$content = '[mermaid]a < b[/mermaid]';

		$this->assertSame( $content, $this->shortcode->protect_code( $content ) );
	}

	/**
	 * Content, as a shortcode gets it, with the code it holds.
	 *
	 * @return array[] The content and the code.
	 */
	public function data_content(): array {
		return array(
			'line breaks of wpautop'         => array( "<br />\nflowchart LR<br />\nA --> B<br />\n", "flowchart LR\nA --> B" ),
			'paragraphs of wpautop'          => array( "<br />\nflowchart LR</p>\n<p>A --> B<br />\n", "flowchart LR\n\nA --> B" ),
			'a paragraph per line'           => array( "\n<p>flowchart LR</p>\n<p>A --> B</p>\n", "flowchart LR\n\nA --> B" ),
			'entities'                       => array( 'A --&gt; B &amp; C &lt;--&gt; D', 'A --> B & C <--> D' ),
			'quotes as entities'             => array( 'A[&quot;It&#039;s&quot;]', 'A["It\'s"]' ),
			'a line break in a label'        => array( "A[one<br/>two] --> B[three<br>four]<br />\n", 'A[one<br/>two] --> B[three<br>four]' ),
			'non-breaking spaces as indents' => array( "mindmap\n&nbsp;&nbsp;root\n\u{a0}\u{a0}\u{a0}\u{a0}child", "mindmap\n  root\n    child" ),
			'Windows line endings'           => array( "flowchart LR\r\nA --> B\r\n", "flowchart LR\nA --> B" ),
			'indentation'                    => array( "mindmap\n  root\n    child\n", "mindmap\n  root\n    child" ),
			'nothing'                        => array( null, '' ),
		);
	}

	/**
	 * The code is what the author wrote, whatever the editors and the content
	 * filters made of it.
	 *
	 * @dataProvider data_content
	 *
	 * @param mixed  $content The content of the shortcode.
	 * @param string $code    The code.
	 */
	public function test_reads_the_code( $content, string $code ): void {
		$this->assertSame( $code, $this->shortcode->get_code( $content ) );
	}

	/**
	 * Nodes named like shortcodes stay text.
	 */
	public function test_leaves_shortcodes_in_the_code_alone(): void {
		add_shortcode( 'graphdraw_test', '__return_empty_string' );

		$code    = "flowchart LR\nA[graphdraw_test] --> B[gallery]";
		$content = apply_filters( 'the_content', $this->shortcode( $code ) );

		remove_shortcode( 'graphdraw_test' );

		$this->assertSame( $code, $this->get_source( $content ) );
	}

	/**
	 * The code is escaped for the page.
	 */
	public function test_escapes_the_code(): void {
		$code   = 'flowchart LR' . "\n" . 'A["<script>alert(1)</script>"] --> B["</pre><img src=x onerror=alert(1)>"]';
		$markup = do_shortcode( $this->shortcode( $code ) );

		$this->assertStringNotContainsString( '<script', $markup );
		$this->assertStringNotContainsString( '<img', $markup );
		$this->assertSame( 1, substr_count( $markup, '</pre>' ) );
		$this->assertSame( $code, $this->get_source( $markup ) );
	}

	/**
	 * A caption makes the diagram a figure, with the HTML posts may have.
	 */
	public function test_adds_a_caption(): void {
		$markup = do_shortcode( $this->shortcode( self::CODE, 'caption="The <em>checkout</em> flow<script>alert(1)</script>"' ) );

		$this->assertStringStartsWith( '<figure class="graphdraw-diagram"', $markup );
		$this->assertStringContainsString( '<figcaption class="graphdraw-diagram__caption wp-element-caption">The <em>checkout</em> flow', $markup );
		$this->assertStringNotContainsString( '<script', $markup );
	}

	/**
	 * Attributes for the controls, with the controls the diagram gets.
	 *
	 * @return array[] The attributes and the controls, or null for none.
	 */
	public function data_controls(): array {
		return array(
			'none'                 => array( '', null ),
			'zoom'                 => array( 'zoom="1"', 'zoom' ),
			'download'             => array( 'download="true"', 'download' ),
			'both'                 => array( 'download="yes" zoom="on"', 'zoom download' ),
			'without values'       => array( 'zoom download', 'zoom download' ),
			'one without a value'  => array( 'caption="Flow" Zoom', 'zoom' ),
			'switched off'         => array( 'zoom="0" download="false"', null ),
			'a word that is no'    => array( 'zoom="no" download="off"', null ),
			'an unknown flag'      => array( 'fast zoom', 'zoom' ),
			'a value wins'         => array( 'zoom zoom="0"', null ),
			'not a control at all' => array( 'controls="zoom"', null ),
		);
	}

	/**
	 * The diagram gets the controls its shortcode switches on.
	 *
	 * @dataProvider data_controls
	 *
	 * @param string      $attributes The attributes.
	 * @param string|null $controls   The controls.
	 */
	public function test_adds_the_controls( string $attributes, ?string $controls ): void {
		$markup = do_shortcode( $this->shortcode( self::CODE, $attributes ) );

		if ( null === $controls ) {
			$this->assertStringNotContainsString( 'data-mermaid-controls', $markup );
		} else {
			$this->assertStringContainsString( ' data-mermaid-controls="' . $controls . '"', $markup );
		}
	}

	/**
	 * The diagram is drawn in the theme of its shortcode, or else the site's.
	 */
	public function test_sets_the_theme(): void {
		update_option( 'graphdraw_theme', 'neutral' );

		$this->assertStringContainsString( ' data-mermaid-theme="forest"', do_shortcode( $this->shortcode( self::CODE, 'theme="forest"' ) ) );
		$this->assertStringContainsString( ' data-mermaid-theme="neutral"', do_shortcode( $this->shortcode() ) );
		$this->assertStringContainsString( ' data-mermaid-theme="neutral"', do_shortcode( $this->shortcode( self::CODE, 'theme="unknown"' ) ) );
	}

	/**
	 * The title and the description for assistive technology are passed on,
	 * escaped, and with brackets that no shortcode expands.
	 */
	public function test_sets_the_accessible_text(): void {
		$markup = do_shortcode( $this->shortcode( self::CODE, 'title="Checkout <flow>" description=\'From "cart" to done\'' ) );

		$this->assertStringContainsString( ' data-mermaid-title="Checkout &lt;flow&gt;"', $markup );
		$this->assertStringContainsString( ' data-mermaid-description="From &quot;cart&quot; to done"', $markup );
		$this->assertStringNotContainsString( 'data-mermaid-title', do_shortcode( $this->shortcode( self::CODE, 'title=" "' ) ) );
	}

	/**
	 * The alignments of the block, and no other class.
	 *
	 * @testWith ["center", "graphdraw-diagram aligncenter"]
	 *           ["wide", "graphdraw-diagram alignwide"]
	 *           ["full", "graphdraw-diagram alignfull"]
	 *           ["left", "graphdraw-diagram"]
	 *           ["wide\" onclick=\"alert(1)", "graphdraw-diagram"]
	 *
	 * @param string $align   The alignment.
	 * @param string $classes The classes of the diagram.
	 */
	public function test_aligns_the_diagram( string $align, string $classes ): void {
		$markup = do_shortcode( $this->shortcode( self::CODE, "align='" . $align . "'" ) );

		$this->assertStringStartsWith( '<div class="' . $classes . '" ', $markup );
		$this->assertStringNotContainsString( 'onclick', $markup );
	}

	/**
	 * The code of both tags is kept away from wptexturize().
	 */
	public function test_keeps_wptexturize_away(): void {
		$tags = apply_filters( 'no_texturize_shortcodes', array( 'code' ) );

		$this->assertSame( array( 'code', 'mermaid', 'graphdraw' ), $tags );
	}

	/**
	 * A plugin that has the short tag keeps it, and how its content is
	 * treated. The prefixed tag still works.
	 */
	public function test_leaves_a_taken_tag_alone(): void {
		remove_shortcode( 'mermaid' );
		remove_shortcode( 'graphdraw' );
		add_shortcode( 'mermaid', '__return_empty_string' );

		$this->shortcode->register();

		$this->assertSame( '', do_shortcode( $this->shortcode() ) );
		$this->assertSame( self::CODE, $this->get_source( do_shortcode( $this->shortcode( self::CODE, '', 'graphdraw' ) ) ) );
		$this->assertSame( array( 'graphdraw' ), $this->shortcode->get_tags() );
		$this->assertSame( array( 'graphdraw' ), apply_filters( 'no_texturize_shortcodes', array() ) );
	}

	/**
	 * The same when a plugin takes the short tag over later.
	 */
	public function test_notices_a_tag_taken_later(): void {
		add_shortcode( 'mermaid', '__return_empty_string' );

		$this->assertSame( array( 'graphdraw' ), $this->shortcode->get_tags() );
	}
}
