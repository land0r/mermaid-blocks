<?php
/**
 * Server-side render for the Mermaid Diagram block.
 *
 * @package MermaidBlocks
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Saved inner content (unused).
 * @var WP_Block $block      Block instance.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$mermaid_blocks_code = isset( $attributes['code'] ) ? (string) $attributes['code'] : '';

if ( '' === trim( $mermaid_blocks_code ) ) {
	return;
}

/*
 * Notes on the markup below:
 *
 * - The source stays inside a <pre>: in classic `the_content` rendering,
 *   wptexturize and convert_smilies run over block output and would turn
 *   `-->` into an en dash and straight quotes into curly quotes everywhere
 *   except inside <pre>/<code>.
 * - esc_textarea() is used instead of esc_html(): esc_html() does not
 *   double-encode, so a literal `&amp;` or `&lt;` typed by the user would come
 *   back from `textContent` as `&` / `<`. esc_textarea() double-encodes, so
 *   `textContent` equals the stored source exactly.
 * - Square brackets are output as numeric entities: `do_shortcode` also runs
 *   over block output, so a node such as `A[gallery]` or `B[audio]` would be
 *   replaced by the shortcode's output. The browser decodes the entities back
 *   to brackets before the front-end script reads the source.
 */
$mermaid_blocks_source = str_replace(
	array( '[', ']' ),
	array( '&#91;', '&#93;' ),
	esc_textarea( $mermaid_blocks_code )
);
?>
<div <?php echo get_block_wrapper_attributes(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped by core. ?>>
	<pre class="mermaid-blocks-diagram__source"><?php echo $mermaid_blocks_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped with esc_textarea() above. ?></pre>
</div>
