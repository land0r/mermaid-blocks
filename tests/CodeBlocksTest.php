<?php
/**
 * Tests of the code shown as diagrams.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Admin\SettingsPage;
use MermaidBlocks\Assets;
use MermaidBlocks\Integrations\Block;
use MermaidBlocks\Integrations\CodeBlocks;
use MermaidBlocks\Options;
use WP_UnitTestCase;

/**
 * Code marked as Mermaid, in Code blocks and in classic content, run through
 * the filters WordPress runs content through.
 *
 * @covers \MermaidBlocks\Integrations\CodeBlocks
 */
class CodeBlocksTest extends WP_UnitTestCase {

	/**
	 * A diagram with what content filters and escaping get wrong: arrows,
	 * quotes, an ampersand, brackets that name a shortcode, a blank line and
	 * indentation.
	 */
	const CODE = "flowchart LR\n  A[gallery] --> B{\"It's fine & done?\"}\n\n  B -->|Yes| C[x < y]";

	/**
	 * The code blocks.
	 *
	 * @var CodeBlocks
	 */
	private CodeBlocks $code_blocks;

	/**
	 * Starts with the setting on, from a page without the assets.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->code_blocks = mermaid_blocks()->get( CodeBlocks::class );

		update_option( Options::CODE_BLOCKS, 1 );

		wp_dequeue_script( Assets::RENDERER );
		wp_dequeue_style( Assets::RENDERER );
	}

	/**
	 * Returns the source in the markup of a diagram, as the browser reads it.
	 *
	 * @param string $markup The markup.
	 *
	 * @return string|null The source, or null when the markup has none.
	 */
	private function get_source( string $markup ): ?string {
		if ( ! preg_match( '#<pre class="mermaid-blocks-diagram__source">(.*?)</pre>#s', $markup, $matches ) ) {
			return null;
		}

		return html_entity_decode( $matches[1], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}

	/**
	 * Returns code as the Code block saves it: with the characters that mean
	 * something to HTML or to shortcodes as character references.
	 *
	 * @param string $code The code.
	 *
	 * @return string The escaped code.
	 */
	private function escape( string $code ): string {
		return str_replace( array( '[', ']' ), array( '&#91;', '&#93;' ), esc_html( $code ) );
	}

	/**
	 * Returns a `<pre>` element holding code in a `<code>` element.
	 *
	 * @param string $code       The code.
	 * @param string $pre_class  The classes of the `<pre>` element.
	 * @param string $code_class The classes of the `<code>` element.
	 *
	 * @return string The element.
	 */
	private function pre( string $code = self::CODE, string $pre_class = '', string $code_class = CodeBlocks::CLASS_NAME ): string {
		return sprintf(
			'<pre%s><code%s>%s</code></pre>',
			'' === $pre_class ? '' : ' class="' . $pre_class . '"',
			'' === $code_class ? '' : ' class="' . $code_class . '"',
			$this->escape( $code )
		);
	}

	/**
	 * Returns a Code block, as it is saved in a post.
	 *
	 * @param string $code       The code.
	 * @param string $class_name Its additional CSS class.
	 * @param string $code_class The classes of its `<code>` element.
	 *
	 * @return string The block markup.
	 */
	private function code_block( string $code = self::CODE, string $class_name = CodeBlocks::CLASS_NAME, string $code_class = '' ): string {
		return sprintf(
			"<!-- wp:code%s -->\n%s\n<!-- /wp:code -->",
			'' === $class_name ? '' : ' ' . wp_json_encode( array( 'className' => $class_name ) ),
			$this->pre( $code, trim( 'wp-block-code ' . $class_name ), $code_class )
		);
	}

	/**
	 * Asserts that markup is one diagram of the given code, in the site's
	 * theme, and that what renders it is loaded.
	 *
	 * @param string $code   The code.
	 * @param string $markup The markup.
	 */
	private function assertIsDiagram( string $code, string $markup ): void {
		$this->assertStringStartsWith( '<div class="mermaid-blocks-diagram" data-mermaid-theme="auto">', trim( $markup ) );
		$this->assertSame( 1, substr_count( $markup, 'mermaid-blocks-diagram__source' ) );
		$this->assertSame( $code, $this->get_source( $markup ) );
		$this->assertStringNotContainsString( '<code', $markup );
		$this->assertTrue( wp_script_is( Assets::RENDERER ) );
		$this->assertTrue( wp_style_is( Assets::RENDERER ) );
	}

	/**
	 * A Code block with the additional CSS class is shown as a diagram.
	 */
	public function test_shows_a_code_block_marked_with_its_css_class(): void {
		$this->assertIsDiagram( self::CODE, do_blocks( $this->code_block() ) );
	}

	/**
	 * A Code block whose `<code>` element has the class, as Markdown
	 * converters and syntax highlighting plugins write it, is shown as a
	 * diagram.
	 */
	public function test_shows_a_code_block_marked_on_its_code_element(): void {
		$this->assertIsDiagram( self::CODE, do_blocks( $this->code_block( self::CODE, '', 'hljs language-mermaid' ) ) );
	}

	/**
	 * A diagram shown this way has the site's theme.
	 */
	public function test_shows_the_diagram_in_the_theme_of_the_site(): void {
		update_option( Options::THEME, 'forest' );

		$this->assertStringStartsWith( '<div class="mermaid-blocks-diagram" data-mermaid-theme="forest">', trim( do_blocks( $this->code_block() ) ) );
	}

	/**
	 * Code blocks that aren't marked as Mermaid.
	 *
	 * @return array[] The additional CSS class, the classes of the `<code>`
	 *                 element and the code.
	 */
	public function data_other_code(): array {
		return array(
			'no class'                   => array( '', '', self::CODE ),
			'another language'           => array( 'language-php', '', 'echo 1;' ),
			'another language, on code'  => array( '', 'language-php', 'echo 1;' ),
			'the class in a longer one'  => array( 'language-mermaid-x', 'xlanguage-mermaid', self::CODE ),
			'the class as code'          => array( '', '', 'language-mermaid' ),
			'the class as an attribute'  => array( '', '', '<code class="language-mermaid">' ),
			'another class with the tag' => array( 'mermaid', 'mermaid', self::CODE ),
		);
	}

	/**
	 * A Code block that isn't marked as Mermaid stays as it is, and loads
	 * nothing.
	 *
	 * @dataProvider data_other_code
	 *
	 * @param string $class_name The additional CSS class.
	 * @param string $code_class The classes of the `<code>` element.
	 * @param string $code       The code.
	 */
	public function test_leaves_other_code_blocks( string $class_name, string $code_class, string $code ): void {
		$block = $this->code_block( $code, $class_name, $code_class );

		$this->assertSame(
			"\n" . $this->pre( $code, trim( 'wp-block-code ' . $class_name ), $code_class ) . "\n",
			do_blocks( $block )
		);
		$this->assertFalse( wp_script_is( Assets::RENDERER ) );
	}

	/**
	 * The class marks code only on the `<code>` element that holds all of it.
	 */
	public function test_leaves_a_code_element_that_follows_other_code(): void {
		$pre = '<pre>graph TD <code class="language-mermaid">A --&gt; B</code></pre>';

		$this->assertNull( $this->code_blocks->get_code( $pre ) );
		$this->assertSame( $pre, $this->code_blocks->render_content( $pre ) );
	}

	/**
	 * Off, which is what the setting is until it is switched on, code stays
	 * code.
	 */
	public function test_leaves_the_code_while_the_setting_is_off(): void {
		$block   = $this->code_block();
		$content = '<p>Before</p>' . $this->pre();

		foreach ( array( 0, null ) as $value ) {
			if ( null === $value ) {
				delete_option( Options::CODE_BLOCKS );
			} else {
				update_option( Options::CODE_BLOCKS, $value );
			}

			$this->assertFalse( $this->code_blocks->is_on() );
			$this->assertStringContainsString( '<pre class="wp-block-code language-mermaid"><code>', do_blocks( $block ) );
			$this->assertSame( $content, $this->code_blocks->render_content( $content ) );
		}

		$this->assertFalse( wp_script_is( Assets::RENDERER ) );
	}

	/**
	 * What a `<pre>` element holds, with the source read from it.
	 *
	 * @return array[] The content of the element and the source.
	 */
	public function data_code(): array {
		return array(
			'character references'       => array(
				'A --&gt; B{&quot;It&#039;s&quot;} &amp; C&#91;x &lt; y&#93;',
				'A --> B{"It\'s"} & C[x < y]',
			),
			'a reference written as one' => array( 'A[&amp;lt;b&amp;gt;]', 'A[&lt;b&gt;]' ),
			'a < that starts no tag'     => array( "classDiagram\nAnimal <|-- Duck\nA <--> B\nx < y", "classDiagram\nAnimal <|-- Duck\nA <--> B\nx < y" ),
			'a line break in a label'    => array( 'A[One<br>Two] --> B[Three<br />Four]', 'A[One<br/>Two] --> B[Three<br/>Four]' ),
			'a typed line break'         => array( 'A[One&lt;br/&gt;Two]', 'A[One<br/>Two]' ),
			'highlighted code'           => array(
				'<span class="hljs-keyword">graph</span> TD' . "\n" . '<strong>A</strong> --&gt; <em>B</em>',
				"graph TD\nA --> B",
			),
			'blank lines around it'      => array( "\n\n  graph TD\n  A --> B\n\n", "graph TD\n  A --> B" ),
			'non-breaking spaces'        => array( "graph TD\n\xC2\xA0\xC2\xA0A&nbsp;--&gt; B", "graph TD\n  A --> B" ),
			'other scripts and emoji'    => array( 'A[Größe] --&gt; B[日本語 🎉]', 'A[Größe] --> B[日本語 🎉]' ),
		);
	}

	/**
	 * The source is the text of the element, as a browser shows it.
	 *
	 * @dataProvider data_code
	 *
	 * @param string $content The content of the `<code>` element.
	 * @param string $code    The source.
	 */
	public function test_reads_the_code_as_a_browser_shows_it( string $content, string $code ): void {
		$pre = '<pre class="wp-block-code"><code class="language-mermaid">' . $content . '</code></pre>';

		$this->assertSame( $code, $this->code_blocks->get_code( $pre ) );
		$this->assertSame( $code, $this->get_source( $this->code_blocks->render_block( $pre ) ) );
	}

	/**
	 * The class on the `<pre>` element marks code that is in no `<code>`
	 * element too.
	 */
	public function test_reads_code_without_a_code_element(): void {
		$this->assertSame( "graph TD\nA --> B", $this->code_blocks->get_code( "<pre class=\"language-mermaid\">\ngraph TD\nA --&gt; B</pre>" ) );
	}

	/**
	 * A Code block without code stays as it is: there is no diagram to show.
	 */
	public function test_leaves_a_code_block_without_code(): void {
		$pre = '<pre class="wp-block-code language-mermaid"><code> </code></pre>';

		$this->assertSame( $pre, $this->code_blocks->render_block( $pre ) );
		$this->assertFalse( wp_script_is( Assets::RENDERER ) );
	}

	/**
	 * A Code block in the content of a post is shown once, as a diagram, with
	 * its code as it was written: no curly quotes, no dashes, no shortcode
	 * run.
	 */
	public function test_shows_a_code_block_in_post_content(): void {
		$content = apply_filters( 'the_content', "<!-- wp:paragraph -->\n<p>Before</p>\n<!-- /wp:paragraph -->\n\n" . $this->code_block() ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		$this->assertStringContainsString( '>Before</p>', $content );
		$this->assertIsDiagram( self::CODE, substr( $content, strpos( $content, '<div' ) ) );
	}

	/**
	 * In classic content, a `<pre>` element marked as Mermaid is shown as a
	 * diagram, between the paragraphs it was between.
	 */
	public function test_shows_code_in_classic_content(): void {
		$content = apply_filters( 'the_content', "Before\n\n" . $this->pre() . "\n\nAfter" ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		$this->assertStringContainsString( '<p>Before</p>', $content );
		$this->assertStringContainsString( '<p>After</p>', $content );
		$this->assertStringNotContainsString( '<p><div', $content );
		$this->assertIsDiagram( self::CODE, substr( $content, strpos( $content, '<div' ), strpos( $content, '</div>' ) + 6 - strpos( $content, '<div' ) ) );
	}

	/**
	 * In classic content, code may have been written by hand: its `<` and
	 * `>` as they are, and a shortcode's name in brackets.
	 */
	public function test_shows_code_written_by_hand(): void {
		$code    = "classDiagram\nAnimal <|-- Duck\nnote for Duck \"[gallery] & [caption]\"";
		$content = apply_filters( 'the_content', "<pre><code class=\"language-mermaid\">\n" . $code . "\n</code></pre>" ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		$this->assertIsDiagram( $code, $content );
	}

	/**
	 * A node named after a shortcode stays in the code: the diagram replaces
	 * the code before the shortcodes of the content run.
	 */
	public function test_keeps_a_node_named_after_a_shortcode(): void {
		$content = apply_filters( 'the_content', "<pre><code class=\"language-mermaid\">graph TD\nA[gallery] --&gt; B[caption]</code></pre>" ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		$this->assertIsDiagram( "graph TD\nA[gallery] --> B[caption]", $content );
	}

	/**
	 * Each marked element of the content becomes a diagram, and the other
	 * `<pre>` elements stay.
	 */
	public function test_shows_each_marked_element_of_the_content(): void {
		$php     = '<pre><code class="language-php">echo "language-mermaid";</code></pre>';
		$content = $this->code_blocks->render_content(
			$this->pre( "graph TD\nA --> B" ) . "\n<p>Between</p>\n" . $php . "\n" . $this->pre( "pie\n\"a\" : 1", 'language-mermaid', '' )
		);

		$this->assertSame( 2, substr_count( $content, 'mermaid-blocks-diagram__source' ) );
		$this->assertStringContainsString( '>graph TD' . "\n" . 'A --&gt; B</pre>', $content );
		$this->assertStringContainsString( '>pie' . "\n" . '&quot;a&quot; : 1</pre>', $content );
		$this->assertStringContainsString( "\n<p>Between</p>\n" . $php . "\n", $content );
	}

	/**
	 * Content that was filtered already has no code left to show, so a
	 * second run changes nothing.
	 */
	public function test_does_not_render_a_diagram_twice(): void {
		$once = apply_filters( 'the_content', $this->code_block() . "\n\n" . $this->pre() ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		$this->assertSame( 2, substr_count( $once, 'mermaid-blocks-diagram__source' ) );
		$this->assertSame( $once, $this->code_blocks->render_content( $once ) );
	}

	/**
	 * A diagram block stays as it is, whatever its code says.
	 */
	public function test_leaves_a_diagram_block(): void {
		$code  = 'graph TD' . "\n" . 'A["<pre><code class=\"language-mermaid\">x</code></pre>"]';
		$block = array(
			'blockName'    => Block::NAME,
			'attrs'        => array( 'code' => $code ),
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);

		$markup  = render_block( $block );
		$content = apply_filters( 'the_content', serialize_block( $block ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		$this->assertSame( $markup, $content );
		$this->assertSame( $code, $this->get_source( $content ) );
	}

	/**
	 * The filter leaves code as code, where something else draws it, and is
	 * told which code.
	 */
	public function test_filter_leaves_code(): void {
		$seen = array();
		add_filter(
			'mermaid_blocks_show_code_as_diagram',
			static function ( $show, $code, $html ) use ( &$seen ) {
				$seen[] = array( $show, $code, $html );

				return 0 !== strpos( $code, 'pie' );
			},
			10,
			3
		);

		$pie     = $this->pre( "pie\n\"a\" : 1" );
		$graph   = $this->pre( "graph TD\nA --> B" );
		$content = $this->code_blocks->render_content( $pie . $graph );

		$this->assertStringStartsWith( $pie . '<div class="mermaid-blocks-diagram"', $content );
		$this->assertSame(
			array(
				array( true, "pie\n\"a\" : 1", $pie ),
				array( true, "graph TD\nA --> B", $graph ),
			),
			$seen
		);
	}

	/**
	 * Content that isn't text is given back as it came.
	 */
	public function test_gives_back_content_that_is_no_text(): void {
		$this->assertNull( $this->code_blocks->render_content( null ) );
	}

	/**
	 * The setting is a switch on the settings page, which is off.
	 */
	public function test_adds_its_switch_to_the_settings_page(): void {
		global $wp_settings_sections, $wp_settings_fields;

		require_once ABSPATH . 'wp-admin/includes/template.php';

		delete_option( Options::CODE_BLOCKS );
		mermaid_blocks()->get( SettingsPage::class )->register();

		$this->assertArrayHasKey( Options::CODE_BLOCKS, get_registered_settings() );
		$this->assertArrayHasKey( Options::CODE_BLOCKS, $wp_settings_fields[ SettingsPage::PAGE ][ SettingsPage::SECTION ] );
		$this->assertFalse( $this->code_blocks->is_on() );

		unregister_setting( SettingsPage::GROUP, Options::THEME );
		unregister_setting( SettingsPage::GROUP, Options::CODE_BLOCKS );
		unset( $wp_settings_sections[ SettingsPage::PAGE ], $wp_settings_fields[ SettingsPage::PAGE ] );
	}

	/**
	 * Deleting the plugin deletes the setting.
	 */
	public function test_uninstall_deletes_the_setting(): void {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'mermaid-blocks/mermaid-blocks.php' );
		}

		require dirname( __DIR__ ) . '/uninstall.php';

		$this->assertFalse( get_option( Options::CODE_BLOCKS ) );
	}
}
