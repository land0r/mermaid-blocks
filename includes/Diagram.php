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
 * An integration whose settings are named as the block's attributes, such as
 * a page builder widget, outputs render(). Others output get_markup(), and
 * make sure the
 * `mermaid-blocks-diagram` script and style are loaded: the method enqueues
 * them, and an integration that renders outside a normal page load declares
 * both handles as its dependencies instead. Diagrams added to the page later,
 * such as a widget a page builder re-renders in its preview, are rendered by
 * calling `window.mermaidBlocks.render( element )`.
 *
 * A diagram whose wrapper has a `data-mermaid-controls` attribute gets
 * controls for visitors: any of CONTROLS, separated by spaces.
 *
 * `data-mermaid-theme` names the theme the diagram is drawn in, one of
 * Themes::get_all(); without it the diagram follows the page.
 * `data-mermaid-title` and `data-mermaid-description` give the rendered SVG a
 * title and a description for assistive technology.
 *
 * A diagram that has a saved image (see SavedImages) carries it for readers
 * that run no JavaScript: in a `<noscript>` element before the source, or, in
 * a feed, in place of the source.
 */
final class Diagram {

	/**
	 * The controls a diagram can give visitors: buttons to zoom, to download
	 * the diagram as an SVG or PNG file, to copy its code, and to show it over
	 * the whole screen. They are also the block's attributes that switch them
	 * on.
	 */
	const CONTROLS = array( 'zoom', 'download', 'copy', 'fullscreen' );

	/**
	 * The alignments of a diagram, as the block has them: each is a class,
	 * such as `aligncenter`.
	 */
	const ALIGNMENTS = array( 'center', 'wide', 'full' );

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * The assets that render diagrams.
	 *
	 * @var Assets
	 */
	private Assets $assets;

	/**
	 * Sets up the diagram markup.
	 *
	 * @param Themes $themes The themes a diagram can be drawn in.
	 * @param Assets $assets The assets that render diagrams.
	 */
	public function __construct( Themes $themes, Assets $assets ) {
		$this->themes = $themes;
		$this->assets = $assets;
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
		return $this->themes->resolve( $theme );
	}

	/**
	 * Returns the controls a diagram gives visitors, from settings named as
	 * the block's attributes: each of CONTROLS whose setting is on.
	 *
	 * @param array $settings The settings, such as `zoom` => true. A setting
	 *                        is on when it isn't empty.
	 *
	 * @return string[] The controls, in the order of CONTROLS.
	 */
	public function get_controls( array $settings ): array {
		$controls = array();

		foreach ( self::CONTROLS as $control ) {
			if ( ! empty( $settings[ $control ] ) ) {
				$controls[] = $control;
			}
		}

		return $controls;
	}

	/**
	 * Returns the attributes of a wrapper that tell the front-end script what
	 * a diagram gets besides its theme: the controls for visitors, and a
	 * title and a description for assistive technology.
	 *
	 * For integrations, which each know these from attributes of their own:
	 * the block from `zoom` and `accTitle`, the shortcode from `zoom` and
	 * `title`. Add the result to the attributes passed to get_markup(), or
	 * to those of a wrapper output with wrap().
	 *
	 * @param string[] $controls    The controls visitors get: any of CONTROLS.
	 *                              They keep the order given.
	 * @param mixed    $title       Optional. A title of the diagram.
	 * @param mixed    $description Optional. A description of the diagram.
	 *
	 * @return array The attributes, as name => value, not escaped. Only those
	 *               that say something: a diagram without controls gets no
	 *               `data-mermaid-controls`.
	 */
	public function get_data_attributes( array $controls, $title = '', $description = '' ): array {
		$attributes = array();

		if ( $controls ) {
			$attributes['data-mermaid-controls'] = implode( ' ', $controls );
		}

		$texts = array(
			'data-mermaid-title'       => $title,
			'data-mermaid-description' => $description,
		);

		foreach ( $texts as $name => $text ) {
			$text = trim( (string) $text );

			if ( '' !== $text ) {
				$attributes[ $name ] = $text;
			}
		}

		return $attributes;
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
	 *   to brackets before Mermaid reads the source. See encode_brackets().
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
	 * Returns the saved image of a diagram.
	 *
	 * Pass it to wrap(), which puts it where readers that run no JavaScript
	 * find it.
	 *
	 * @param array  $image The URL of the image, and the width and the height
	 *                      to show it at, as SavedImages::find() returns them.
	 * @param string $alt   Optional. What the diagram shows, for those who
	 *                      can't see the image. Default: that it is a diagram.
	 *
	 * @return string The `<img>` element.
	 */
	public function get_image_markup( array $image, $alt = '' ): string {
		$alt = trim( (string) $alt );

		return sprintf(
			'<img class="mermaid-blocks-diagram__image" src="%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async" />',
			esc_url( $image['url'] ),
			esc_attr( '' === $alt ? __( 'Diagram', 'mermaid-blocks' ) : $alt ),
			(int) $image['width'],
			(int) $image['height']
		);
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
	 *                           They include the `mermaid-blocks-diagram` class,
	 *                           and the `has-image` class for a diagram given an
	 *                           image.
	 * @param string $code       Mermaid source.
	 * @param string $caption    Optional. A caption, shown under the diagram. It
	 *                           may contain the HTML allowed in post content.
	 * @param string $image      Optional. The saved image of the diagram, as
	 *                           get_image_markup() returns it. It goes in a
	 *                           `<noscript>` element before the source, for
	 *                           browsers that run no JavaScript.
	 * @param bool   $image_only Optional. Whether the image takes the place of
	 *                           the source, as in a feed, where nothing renders
	 *                           the source. Default false.
	 *
	 * @return string The diagram markup.
	 */
	public function wrap( string $attributes, $code, $caption = '', $image = '', $image_only = false ): string {
		$caption_markup = $this->get_caption_markup( $caption );
		$tag            = '' === $caption_markup ? 'div' : 'figure';
		$image          = $this->encode_brackets( $image );

		if ( '' === $image ) {
			$content = $this->get_source_markup( $code );
		} elseif ( $image_only ) {
			$content = $image;
		} else {
			$content = '<noscript>' . $image . '</noscript>' . $this->get_source_markup( $code );
		}

		return sprintf(
			'<%1$s %2$s>%3$s%4$s</%1$s>',
			$tag,
			$this->encode_brackets( $attributes ),
			$content,
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
	 *                           get: any of CONTROLS, separated by spaces, such
	 *                           as `zoom download`.
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

		$this->assets->enqueue_diagram();

		return $this->wrap( implode( ' ', $attribute_markup ), $code, $caption );
	}

	/**
	 * Returns the markup of a diagram from settings named as the block's
	 * attributes, and enqueues the assets that render it.
	 *
	 * For an integration that has the block's settings, such as a page builder
	 * widget. The shortcode passes its attributes under these names too. The
	 * block builds its wrapper with the attributes the block editor adds, so
	 * it uses the parts of this method instead: get_theme(), get_controls(),
	 * get_data_attributes() and wrap().
	 *
	 * @param array $settings The settings, each optional:
	 *                        `code`, the Mermaid source;
	 *                        `theme`, a name from Themes::get_all(): without
	 *                        one, or with an unknown one, the site's;
	 *                        `zoom`, `download`, `copy` and `fullscreen`, the
	 *                        controls visitors get, each when it isn't empty;
	 *                        `caption`, which may contain the HTML allowed in
	 *                        post content;
	 *                        `accTitle` and `accDescr`, a title and a
	 *                        description for assistive technology;
	 *                        `align`, one of ALIGNMENTS.
	 *                        Other settings are ignored.
	 *
	 * @return string The diagram markup, or an empty string when there is no code.
	 */
	public function render( array $settings ): string {
		$wrapper = array();

		$align = isset( $settings['align'] ) ? $settings['align'] : '';
		if ( in_array( $align, self::ALIGNMENTS, true ) ) {
			$wrapper['class'] = 'align' . $align;
		}

		// An unknown theme, or none, gives the diagram the site's.
		if ( isset( $settings['theme'] ) && is_string( $settings['theme'] ) && '' !== $settings['theme'] ) {
			$wrapper['data-mermaid-theme'] = $settings['theme'];
		}

		$wrapper += $this->get_data_attributes(
			$this->get_controls( $settings ),
			isset( $settings['accTitle'] ) ? $settings['accTitle'] : '',
			isset( $settings['accDescr'] ) ? $settings['accDescr'] : ''
		);

		return $this->get_markup(
			isset( $settings['code'] ) ? $settings['code'] : '',
			$wrapper,
			isset( $settings['caption'] ) ? $settings['caption'] : ''
		);
	}
}
