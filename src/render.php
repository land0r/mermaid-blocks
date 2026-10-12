<?php
/**
 * Server-side render for the Mermaid Diagram block.
 *
 * The markup is shared with other integrations: see includes/diagram.php.
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
?>
<div <?php echo get_block_wrapper_attributes( array( 'class' => 'mermaid-blocks-diagram' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped by core. ?>>
	<?php echo mermaid_blocks_get_diagram_source_markup( $mermaid_blocks_code ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the function. ?>
</div>
