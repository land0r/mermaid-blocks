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
 */
?>
<div <?php echo get_block_wrapper_attributes(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped by core. ?>>
	<pre class="mermaid-blocks-diagram__source"><?php echo esc_textarea( $mermaid_blocks_code ); ?></pre>
</div>
