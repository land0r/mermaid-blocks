<?php
/**
 * Code marked as Mermaid, shown as diagrams.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Integrations;

use GraphDraw\Diagram;
use GraphDraw\Hookable;
use GraphDraw\Options;
use WP_HTML_Tag_Processor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shows the Mermaid code that is in a post as code as a diagram: a `<pre>`
 * element that has the `language-mermaid` class, or whose `<code>` element
 * has it, which is how Markdown converters write a fenced `mermaid` block.
 *
 * It is a setting, off by default, since it changes how existing content is
 * displayed. Only visitors see the diagram: the post and the editor keep the
 * code, and a diagram shown this way has the site's theme and no settings of
 * its own. Transforming the code into a diagram block gives it those.
 *
 * The code is replaced on the server, so a script that looks for such code in
 * the page, another plugin's for example, finds none and doesn't draw it a
 * second time.
 */
final class CodeBlocks implements Hookable {

	/**
	 * The class that marks code as Mermaid.
	 */
	const CLASS_NAME = 'language-mermaid';

	/**
	 * The diagram markup, which replaces the code.
	 *
	 * @var Diagram
	 */
	private Diagram $diagram;

	/**
	 * The stored settings, which hold the switch.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * Sets up the code blocks.
	 *
	 * @param Diagram $diagram The diagram markup.
	 * @param Options $options The stored settings.
	 */
	public function __construct( Diagram $diagram, Options $options ) {
		$this->diagram = $diagram;
		$this->options = $options;
	}

	/**
	 * Adds the filters that replace the code to WordPress.
	 */
	public function hooks(): void {
		// Wherever a Code block is rendered: post content, widgets, templates.
		add_filter( 'render_block_core/code', array( $this, 'render_block' ) );

		/*
		 * Code that is in no Code block: classic content, and HTML written by
		 * hand. After wpautop() and wptexturize(), which leave a `<pre>` as it
		 * is, so they never see the diagram, and before do_shortcode(), which
		 * would expand a node such as `A[gallery]` in the code.
		 */
		add_filter( 'the_content', array( $this, 'render_content' ) );
	}

	/**
	 * Tells whether code marked as Mermaid is shown as diagrams: a switch on
	 * the settings page.
	 *
	 * @return bool Whether the setting is on.
	 */
	public function is_on(): bool {
		return $this->options->is_on( Options::CODE_BLOCKS );
	}

	/**
	 * Shows a Code block marked as Mermaid as a diagram.
	 *
	 * @param string $block_content The rendered block.
	 *
	 * @return string The diagram, or the block as it was.
	 */
	public function render_block( $block_content ) {
		$markup = $this->get_markup( (string) $block_content );

		return null === $markup ? $block_content : $markup;
	}

	/**
	 * Shows the code marked as Mermaid in the content of a post as diagrams.
	 *
	 * @param string $content The content.
	 *
	 * @return string The content, with a diagram in place of each such `<pre>`
	 *                element.
	 */
	public function render_content( $content ) {
		// Most content has no such code, and is not searched for elements.
		if ( ! is_string( $content ) || false === strpos( $content, self::CLASS_NAME ) || ! $this->is_on() ) {
			return $content;
		}

		$rendered = preg_replace_callback( '#<pre\b[^>]*>.*?</pre\s*>#is', array( $this, 'render_match' ), $content );

		return null === $rendered ? $content : $rendered;
	}

	/**
	 * Shows a `<pre>` element found in content as a diagram, if it is marked
	 * as Mermaid.
	 *
	 * @param string[] $matches The element.
	 *
	 * @return string The diagram, or the element as it was.
	 */
	public function render_match( $matches ): string {
		$markup = $this->get_markup( $matches[0] );

		return null === $markup ? $matches[0] : $markup;
	}

	/**
	 * Returns the diagram for a `<pre>` element marked as Mermaid, and
	 * enqueues the assets that render it.
	 *
	 * @param string $html The element.
	 *
	 * @return string|null The diagram markup, or null for other elements, for
	 *                     code that is empty, and while the setting is off.
	 */
	private function get_markup( string $html ): ?string {
		// The class is looked for as text first: it is the cheapest check, and this runs for every Code block.
		if ( false === strpos( $html, self::CLASS_NAME ) || ! $this->is_on() ) {
			return null;
		}

		$code = $this->get_code( $html );

		if ( null === $code ) {
			return null;
		}

		/**
		 * Filters whether code marked as Mermaid is shown as a diagram.
		 *
		 * Return false where something else draws that code, or to leave some
		 * of it as code.
		 *
		 * @param bool   $show Whether to show the code as a diagram.
		 * @param string $code The Mermaid source.
		 * @param string $html The `<pre>` element the code is in.
		 */
		if ( ! apply_filters( 'graphdraw_show_code_as_diagram', true, $code, $html ) ) {
			return null;
		}

		$markup = $this->diagram->get_markup( $code );

		return '' === $markup ? null : $markup;
	}

	/**
	 * Returns the Mermaid source in a `<pre>` element marked as Mermaid: its
	 * text, as a browser shows it.
	 *
	 * The class is on the `<pre>` element, where the block editor puts the
	 * additional CSS class of a Code block, or on the `<code>` element that
	 * is the first thing in it. The word as part of the code, or of another
	 * class, marks nothing.
	 *
	 * The text is read token by token, not with strip_tags(): a `<` that
	 * starts no tag, such as the one in `Animal <|-- Duck` or `A <--> B`, is
	 * text, as it is to a browser. Character references are decoded. Elements
	 * inside the code, such as what a syntax highlighter adds, are dropped and
	 * their text is kept. A `<br>` element is the exception: it is a line
	 * break in a label, which Mermaid reads as `<br/>`.
	 *
	 * @param string $html The element, starting at its opening tag.
	 *
	 * @return string|null The source, or null when the element isn't marked as
	 *                     Mermaid.
	 */
	public function get_code( string $html ): ?string {
		$processor = new WP_HTML_Tag_Processor( $html );

		if ( ! $processor->next_tag( 'PRE' ) ) {
			return null;
		}

		$is_mermaid = true === $processor->has_class( self::CLASS_NAME );
		$is_first   = true;
		$code       = '';

		while ( $processor->next_token() ) {
			$type = $processor->get_token_type();

			if ( '#text' === $type ) {
				$text = $processor->get_modifiable_text();

				if ( '' !== trim( $text ) ) {
					$is_first = false;
				}

				$code .= $text;
				continue;
			}

			if ( '#tag' !== $type ) {
				continue;
			}

			$tag = $processor->get_tag();

			if ( $processor->is_tag_closer() ) {
				if ( 'PRE' === $tag ) {
					break;
				}

				continue;
			}

			if ( $is_first && 'CODE' === $tag && true === $processor->has_class( self::CLASS_NAME ) ) {
				$is_mermaid = true;
			}

			if ( 'BR' === $tag ) {
				$code .= '<br/>';
			}

			$is_first = false;
		}

		if ( ! $is_mermaid ) {
			return null;
		}

		// Editors write a non-breaking space where two spaces follow each other.
		return trim( str_replace( "\xC2\xA0", ' ', $code ) );
	}
}
