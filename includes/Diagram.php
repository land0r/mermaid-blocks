<?php
/**
 * Diagram markup, shared by the block and any other integration, such as a
 * shortcode or a page builder widget.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds the markup of a diagram: its source, escaped, in a wrapper that the
 * front-end script finds and renders.
 *
 * An integration outputs get_markup() and makes sure the
 * `mermaid-blocks-diagram` script and style are loaded: the method enqueues
 * them, and an integration that renders outside a normal page load declares
 * both handles as its dependencies instead. Diagrams added to the page later,
 * such as a widget a page builder re-renders in its preview, are rendered by
 * calling `window.mermaidBlocks.render( element )`.
 *
 * A diagram whose wrapper has a `data-mermaid-controls` attribute gets
 * controls for visitors: `zoom`, `download`, or both, separated by a space.
 *
 * `data-mermaid-theme` names the theme the diagram is drawn in, one of
 * Themes::get_all(); without it the diagram follows the page.
 * `data-mermaid-title` and `data-mermaid-description` give the rendered SVG a
 * title and a description for assistive technology.
 */
final class Diagram {

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * The settings, which hold the site's theme.
	 *
	 * @var Settings
	 */
	private Settings $settings;

	/**
	 * The assets that render diagrams.
	 *
	 * @var Assets
	 */
	private Assets $assets;

	/**
	 * Sets up the diagram markup.
	 *
	 * @param Themes   $themes   The themes a diagram can be drawn in.
	 * @param Settings $settings The settings, which hold the site's theme.
	 * @param Assets   $assets   The assets that render diagrams.
	 */
	public function __construct( Themes $themes, Settings $settings, Assets $assets ) {
		$this->themes   = $themes;
		$this->settings = $settings;
		$this->assets   = $assets;
	}

	/**
	 * Returns the theme a diagram is drawn in: its own, or else the site's,
	 * set under Settings > Mermaid Blocks.
	 *
	 * @param mixed $theme Optional. The theme chosen for the diagram.
	 *
	 * @return string A name from Themes::get_all().
	 */
	public function get_theme( $theme = '' ): string {
		return $this->themes->exists( $theme ) ? $theme : $this->settings->get_theme();
	}

	/**
	 * Encodes the square brackets in escaped text or attributes, so
	 * do_shortcode(), which runs over post content and over the attributes of
	 * its tags, leaves them alone. The browser decodes them back to brackets.
	 *
	 * @param string $html Escaped text, or the attributes of a tag.
	 *
	 * @return string The same, with its brackets as numeric entities.
	 */
	public function encode_brackets( $html ): string {
		return str_replace( array( '[', ']' ), array( '&#91;', '&#93;' ), (string) $html );
	}

	/**
	 * Returns the diagram source, escaped for the page.
	 *
	 * Output it as the content of an element with the `mermaid-blocks-diagram`
	 * class. get_markup() and wrap() do both.
	 *
	 * - The source stays inside a <pre>: wptexturize and convert_smilies run
	 *   over post content and would turn `-->` into an en dash and straight
	 *   quotes into curly quotes everywhere except inside <pre> and <code>.
	 * - esc_textarea() is used instead of esc_html(): esc_html() does not
	 *   double-encode, so a literal `&amp;` or `&lt;` typed by the user would
	 *   come back from `textContent` as `&` or `<`. esc_textarea() double-encodes,
	 *   so `textContent` equals the source exactly.
	 * - Square brackets are output as numeric entities: do_shortcode() also runs
	 *   over post content, so a node such as `A[gallery]` or `B[audio]` would be
	 *   replaced by the shortcode's output. The browser decodes the entities back
	 *   to brackets before the renderer reads the source. See encode_brackets().
	 *
	 * @param string $code Mermaid source.
	 *
	 * @return string The `<pre>` element holding the source.
	 */
	public function get_source_markup( $code ): string {
		$source = $this->encode_brackets( esc_textarea( (string) $code ) );

		return '<pre class="mermaid-blocks-diagram__source">' . $source . '</pre>';
	}

	/**
	 * Returns the caption of a diagram.
	 *
	 * Output it after the source, in a `<figure>` with the
	 * `mermaid-blocks-diagram` class. get_markup() and wrap() do both.
	 *
	 * @param string $caption The caption. It may contain the HTML allowed in
	 *                        post content.
	 *
	 * @return string The `<figcaption>` element, or an empty string when there is
	 *                no caption.
	 */
	public function get_caption_markup( $caption ): string {
		$caption = trim( (string) $caption );

		if ( '' === $caption ) {
			return '';
		}

		return '<figcaption class="mermaid-blocks-diagram__caption wp-element-caption">' . wp_kses_post( $caption ) . '</figcaption>';
	}

	/**
	 * Returns the source and the caption of a diagram in a wrapper with the
	 * given attributes: a `<figure>` when there is a caption, a `<div>` without
	 * one.
	 *
	 * For integrations that build the wrapper's attributes themselves, as the
	 * block does to keep those the block editor adds. Their brackets are
	 * encoded here. Unlike get_markup(), it doesn't enqueue the assets.
	 *
	 * @param string $attributes The wrapper's attributes, escaped, such as
	 *                           get_block_wrapper_attributes() returns them.
	 *                           They include the `mermaid-blocks-diagram` class.
	 * @param string $code       Mermaid source.
	 * @param string $caption    Optional. A caption, shown under the diagram. It
	 *                           may contain the HTML allowed in post content.
	 *
	 * @return string The diagram markup.
	 */
	public function wrap( string $attributes, $code, $caption = '' ): string {
		$caption_markup = $this->get_caption_markup( $caption );
		$tag            = '' === $caption_markup ? 'div' : 'figure';

		return sprintf(
			'<%1$s %2$s>%3$s%4$s</%1$s>',
			$tag,
			$this->encode_brackets( $attributes ),
			$this->get_source_markup( $code ),
			$caption_markup
		);
	}

	/**
	 * Returns the markup of a diagram, and enqueues the assets that render it.
	 *
	 * @param string $code       Mermaid source.
	 * @param array  $attributes Optional. Extra attributes for the wrapper
	 *                           element, as name => value. A `class` is added to
	 *                           the `mermaid-blocks-diagram` class.
	 *                           `data-mermaid-controls` lists the controls visitors
	 *                           get: `zoom`, `download`, or `zoom download`.
	 *                           `data-mermaid-theme` is the diagram's theme, a name
	 *                           from Themes::get_all(): without one, or with an
	 *                           unknown one, it gets the site's.
	 *                           `data-mermaid-title` and `data-mermaid-description`
	 *                           describe the diagram to assistive technology.
	 * @param string $caption    Optional. A caption, shown under the diagram. It
	 *                           may contain the HTML allowed in post content. With
	 *                           a caption the wrapper is a `<figure>`, without one
	 *                           a `<div>`.
	 *
	 * @return string The diagram markup, or an empty string when there is no code.
	 */
	public function get_markup( $code, $attributes = array(), $caption = '' ): string {
		$code = (string) $code;

		if ( '' === trim( $code ) ) {
			return '';
		}

		$attributes = (array) $attributes;

		$class               = isset( $attributes['class'] ) ? $attributes['class'] : '';
		$attributes['class'] = trim( 'mermaid-blocks-diagram ' . $class );

		$theme                            = isset( $attributes['data-mermaid-theme'] ) ? $attributes['data-mermaid-theme'] : '';
		$attributes['data-mermaid-theme'] = $this->get_theme( $theme );

		$attribute_markup = array();
		foreach ( $attributes as $name => $value ) {
			if ( ! preg_match( '/^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/', (string) $name ) ) {
				continue;
			}

			$attribute_markup[] = sprintf( '%s="%s"', $name, esc_attr( $value ) );
		}

		$this->assets->enqueue_renderer();

		return $this->wrap( implode( ' ', $attribute_markup ), $code, $caption );
	}
}
