<?php
/**
 * The shortcode, for diagrams where the block can't be used.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the shortcode and renders it: the classic editor, page builders,
 * text widgets and anything else that runs shortcodes get the same diagrams
 * as the block.
 *
 *     [mermaid caption="Checkout" zoom download]
 *     flowchart LR
 *     A[Cart] --> B{Paid?}
 *     [/mermaid]
 *
 * The attributes are those of the block: `theme`, `caption`, `zoom`,
 * `download`, `title`, `description` and `align`.
 */
final class Shortcode {

	/**
	 * The tag of the shortcode, unless something else registered it first.
	 */
	const TAG = 'mermaid';

	/**
	 * The tag that is always this plugin's.
	 */
	const PREFIXED_TAG = 'mermaid_blocks';

	/**
	 * The attributes, with their defaults.
	 */
	const ATTRIBUTES = array(
		'theme'       => '',
		'caption'     => '',
		'zoom'        => false,
		'download'    => false,
		'title'       => '',
		'description' => '',
		'align'       => '',
	);

	/**
	 * The attributes that are on or off, which are also the controls visitors
	 * get. They can be written without a value.
	 */
	const FLAGS = array( 'zoom', 'download' );

	/**
	 * The alignments, as the block has them.
	 */
	const ALIGNMENTS = array( 'center', 'wide', 'full' );

	/**
	 * The diagram markup.
	 *
	 * @var Diagram
	 */
	private Diagram $diagram;

	/**
	 * Sets up the shortcode.
	 *
	 * @param Diagram $diagram The diagram markup.
	 */
	public function __construct( Diagram $diagram ) {
		$this->diagram = $diagram;
	}

	/**
	 * Adds the hooks of the shortcode to WordPress.
	 */
	public function hooks(): void {
		// Late, so a plugin that has the `mermaid` tag keeps it.
		add_action( 'init', array( $this, 'register' ), 20 );
		add_filter( 'no_texturize_shortcodes', array( $this, 'skip_texturize' ) );
	}

	/**
	 * Registers the shortcode: under its prefixed tag, and under the short one
	 * when no other plugin uses it.
	 */
	public function register(): void {
		add_shortcode( self::PREFIXED_TAG, array( $this, 'render' ) );

		if ( ! shortcode_exists( self::TAG ) ) {
			add_shortcode( self::TAG, array( $this, 'render' ) );
		}
	}

	/**
	 * Returns the tags that run this shortcode now: another plugin may have
	 * taken one over since it was registered.
	 *
	 * @return string[] The tags.
	 */
	public function get_tags(): array {
		global $shortcode_tags;

		$tags = array();

		foreach ( array( self::TAG, self::PREFIXED_TAG ) as $tag ) {
			if ( isset( $shortcode_tags[ $tag ] ) && array( $this, 'render' ) === $shortcode_tags[ $tag ] ) {
				$tags[] = $tag;
			}
		}

		return $tags;
	}

	/**
	 * Keeps wptexturize() away from the code: it would turn `-->` into a dash
	 * and straight quotes into curly ones.
	 *
	 * @param mixed $tags The tags of the shortcodes whose content is left alone.
	 *
	 * @return array The tags, with those of this shortcode.
	 */
	public function skip_texturize( $tags ): array {
		return array_merge( (array) $tags, $this->get_tags() );
	}

	/**
	 * Renders the shortcode.
	 *
	 * @param mixed  $attributes The attributes of the shortcode: an array, or an
	 *                           empty string when it has none.
	 * @param mixed  $content    The content of the shortcode: the Mermaid source.
	 * @param string $tag        The tag the shortcode was written with.
	 *
	 * @return string The diagram markup, or an empty string when there is no code.
	 */
	public function render( $attributes, $content = '', $tag = '' ): string {
		$attributes = shortcode_atts( self::ATTRIBUTES, $this->read_flags( (array) $attributes ), (string) $tag );
		$wrapper    = array();

		if ( in_array( $attributes['align'], self::ALIGNMENTS, true ) ) {
			$wrapper['class'] = 'align' . $attributes['align'];
		}

		// An unknown theme, or none, gives the diagram the site's.
		if ( is_string( $attributes['theme'] ) && '' !== $attributes['theme'] ) {
			$wrapper['data-mermaid-theme'] = $attributes['theme'];
		}

		$controls = array();
		foreach ( self::FLAGS as $flag ) {
			if ( filter_var( $attributes[ $flag ], FILTER_VALIDATE_BOOLEAN ) ) {
				$controls[] = $flag;
			}
		}

		if ( $controls ) {
			$wrapper['data-mermaid-controls'] = implode( ' ', $controls );
		}

		$texts = array(
			'title'       => 'data-mermaid-title',
			'description' => 'data-mermaid-description',
		);
		foreach ( $texts as $text => $name ) {
			$value = trim( (string) $attributes[ $text ] );

			if ( '' !== $value ) {
				$wrapper[ $name ] = $value;
			}
		}

		return $this->diagram->get_markup( $this->get_code( $content ), $wrapper, (string) $attributes['caption'] );
	}

	/**
	 * Turns the flags written without a value, as in `[mermaid zoom]`, into
	 * attributes that are on. WordPress lists those by number.
	 *
	 * @param array $attributes The attributes, as WordPress parsed them.
	 *
	 * @return array The attributes by name.
	 */
	private function read_flags( array $attributes ): array {
		foreach ( $attributes as $name => $value ) {
			if ( ! is_int( $name ) ) {
				continue;
			}

			unset( $attributes[ $name ] );

			$flag = is_string( $value ) ? strtolower( $value ) : '';

			if ( in_array( $flag, self::FLAGS, true ) && ! isset( $attributes[ $flag ] ) ) {
				$attributes[ $flag ] = true;
			}
		}

		return $attributes;
	}

	/**
	 * Returns the Mermaid source in the content of a shortcode, as its author
	 * wrote it.
	 *
	 * Before a shortcode runs, wpautop() ends each of its lines with `<br />`
	 * and wraps what blank lines separate in `<p>`. The editors and kses also
	 * store `>`, `<` and `&` as entities, and the visual editor stores repeated
	 * spaces as non-breaking ones. A `<br>` in the middle of a line stays: it is
	 * a line break in a label.
	 *
	 * @param mixed $content The content of the shortcode.
	 *
	 * @return string The Mermaid source.
	 */
	public function get_code( $content ): string {
		$code = str_replace( array( "\r\n", "\r" ), "\n", (string) $content );

		// Paragraphs back to blank lines, and line breaks to the ends of lines.
		$code = (string) preg_replace( '#</p>\s*<p>#i', "\n\n", $code );
		$code = (string) preg_replace( '#</?p>#i', '', $code );
		$code = (string) preg_replace( '#<br\s*/?>[ \t]*(\n|$)#i', "\n", $code );

		$code = html_entity_decode( $code, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$code = str_replace( "\xC2\xA0", ' ', $code );

		return trim( $code, "\n" );
	}
}
