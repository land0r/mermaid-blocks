<?php
/**
 * Tests of the block.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Block;
use MermaidBlocks\SavedImages;
use WP_Post;
use WP_UnitTestCase;

require_once __DIR__ . '/ImageHelpers.php';

/**
 * The markup the block renders on the server.
 *
 * @covers \MermaidBlocks\Block
 */
class BlockTest extends WP_UnitTestCase {

	use ImageHelpers;

	/**
	 * Removes the files a test saved.
	 */
	public function tear_down(): void {
		$this->remove_added_uploads();

		parent::tear_down();
	}

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

	/**
	 * Creates a post with one diagram that has a saved image, and makes it
	 * the post being shown.
	 *
	 * @param array $attributes The attributes of the diagram, besides its code.
	 *
	 * @return WP_Post The post.
	 */
	private function enter_post_with_image( array $attributes = array() ): WP_Post {
		update_option( SavedImages::OPTION, 1 );

		// Someone whose posts are saved as written: kses changes the code of others.
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$images = mermaid_blocks()->images();
		$theme  = isset( $attributes['theme'] ) ? $attributes['theme'] : '';
		$post   = $this->create_post( array( $this->diagram_block( "graph TD\nA --> B", $attributes ) ) );

		$images->save( $post, $images->get_key( "graph TD\nA --> B", $theme ), '' === $theme ? 'auto' : $theme, $this->png( 600, 300 ) );

		$this->enter_post( $post );

		return $post;
	}

	/**
	 * Returns the saved image as the block outputs it.
	 *
	 * @param WP_Post $post  The post.
	 * @param string  $alt   The text of the image.
	 * @param string  $theme The theme the image was drawn in.
	 *
	 * @return string The `<img>` element.
	 */
	private function get_image_markup( WP_Post $post, string $alt = 'Diagram', string $theme = 'auto' ): string {
		$uploads = wp_get_upload_dir();

		return sprintf(
			'<img class="mermaid-blocks-diagram__image" src="%s/mermaid-blocks/%d-%s-%s.png" alt="%s" width="300" height="150" loading="lazy" decoding="async" />',
			$uploads['baseurl'],
			$post->ID,
			mermaid_blocks()->images()->get_key( "graph TD\nA --> B", 'auto' === $theme ? '' : $theme ),
			$theme,
			$alt
		);
	}

	/**
	 * A diagram with a saved image carries it for browsers that run no
	 * JavaScript, before the source the script renders, and says so in its
	 * class.
	 */
	public function test_carries_its_saved_image(): void {
		$post   = $this->enter_post_with_image();
		$markup = $this->render();

		$this->assertStringStartsWith( '<div class="mermaid-blocks-diagram has-image wp-block-mermaid-blocks-diagram" data-mermaid-theme="auto">', $markup );
		$this->assertStringContainsString(
			'<noscript>' . $this->get_image_markup( $post ) . '</noscript><pre class="mermaid-blocks-diagram__source">graph TD',
			$markup
		);
	}

	/**
	 * A diagram with a theme of its own has the image drawn in that theme.
	 */
	public function test_carries_the_image_of_its_theme(): void {
		$post = $this->enter_post_with_image( array( 'theme' => 'forest' ) );

		$this->assertStringContainsString( $this->get_image_markup( $post, 'Diagram', 'forest' ), $this->render( array( 'theme' => 'forest' ) ) );
		$this->assertStringNotContainsString( '<img', $this->render() );
	}

	/**
	 * The image says what the diagram shows: its description, or else its
	 * title, escaped for an attribute, and safe from shortcodes.
	 */
	public function test_describes_the_image(): void {
		$post = $this->enter_post_with_image();

		$this->assertStringContainsString(
			$this->get_image_markup( $post, 'Who &quot;pays&quot; &lt;whom&gt; &#91;gallery&#93;' ),
			$this->render(
				array(
					'accTitle' => 'Payments',
					'accDescr' => ' Who "pays" <whom> [gallery] ',
				)
			)
		);
		$this->assertStringContainsString( $this->get_image_markup( $post, 'Payments' ), $this->render( array( 'accTitle' => 'Payments' ) ) );
	}

	/**
	 * Where the image replaces the source, as in a feed, the diagram is the
	 * image, with its caption.
	 */
	public function test_shows_the_image_in_place_of_the_source(): void {
		$post = $this->enter_post_with_image();

		add_filter( 'mermaid_blocks_image_replaces_source', '__return_true' );

		$this->assertSame(
			'<figure class="mermaid-blocks-diagram has-image wp-block-mermaid-blocks-diagram" data-mermaid-theme="auto">'
			. $this->get_image_markup( $post )
			. '<figcaption class="mermaid-blocks-diagram__caption wp-element-caption">How it <em>works</em></figcaption></figure>',
			$this->render( array( 'caption' => 'How it <em>works</em>' ) )
		);
	}

	/**
	 * In a feed, readers get the image of a diagram instead of its code.
	 */
	public function test_shows_the_image_in_a_feed(): void {
		$post = $this->enter_post_with_image();

		$this->go_to( '/?feed=rss2' );
		$this->assertTrue( have_posts() );
		the_post();

		$content = get_the_content_feed( 'rss2' );

		$this->assertSame( $post->ID, get_the_ID() );
		$this->assertStringContainsString( $this->get_image_markup( $post ), $content );
		$this->assertStringNotContainsString( 'graph TD', $content );
		$this->assertStringNotContainsString( '<noscript', $content );
	}

	/**
	 * On a page, the image comes through the filters of the content as it
	 * was output, next to the source.
	 */
	public function test_keeps_the_image_in_the_content_of_a_post(): void {
		$post    = $this->enter_post_with_image();
		$content = apply_filters( 'the_content', $post->post_content ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		$this->assertStringContainsString( '<noscript>' . $this->get_image_markup( $post ) . '</noscript><pre class="mermaid-blocks-diagram__source">graph TD', $content );
	}

	/**
	 * A diagram that changed since its image was saved shows its source and
	 * nothing else, as a diagram without an image does.
	 */
	public function test_falls_back_to_the_source_when_the_diagram_changed(): void {
		$post    = $this->enter_post_with_image();
		$without = '<div class="mermaid-blocks-diagram wp-block-mermaid-blocks-diagram" data-mermaid-theme="auto"><pre class="mermaid-blocks-diagram__source">graph TD' . "\n" . 'A --&gt; C</pre></div>';

		$changed = render_block( $this->diagram_block( "graph TD\nA --> C" ) );

		$this->assertSame( $without, $changed );

		// As the abilities change a diagram: on the server, with no editor to draw it again.
		$diagrams = mermaid_blocks()->post_diagrams();
		$diagrams->replace( $post, 0, $diagrams->get_hash( $diagrams->get( $post, 0 ) ), $this->diagram_block( "graph TD\nA --> C" ) );
		$this->enter_post( get_post( $post->ID ) );

		$this->assertSame( "\n" . $without . "\n", "\n" . trim( apply_filters( 'the_content', get_post( $post->ID )->post_content ) ) . "\n" ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- The filter of WordPress.

		add_filter( 'mermaid_blocks_image_replaces_source', '__return_true' );

		$this->assertSame( $without, render_block( $this->diagram_block( "graph TD\nA --> C" ) ) );
	}

	/**
	 * A diagram shows no image while the setting is off, nor outside the post
	 * the image was saved for.
	 */
	public function test_carries_no_image_while_the_setting_is_off_or_outside_its_post(): void {
		$this->enter_post_with_image();
		$this->assertStringContainsString( '<img', $this->render() );

		update_option( SavedImages::OPTION, 0 );
		$this->assertStringNotContainsString( '<img', $this->render() );
		$this->assertStringNotContainsString( 'has-image', $this->render() );

		update_option( SavedImages::OPTION, 1 );
		$this->enter_post( $this->create_post( array( $this->diagram_block( "graph TD\nA --> B" ) ) ) );
		$this->assertStringNotContainsString( '<img', $this->render() );

		unset( $GLOBALS['post'] );
		$this->assertStringNotContainsString( '<img', $this->render() );
	}
}
