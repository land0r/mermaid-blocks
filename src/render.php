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

$mermaid_blocks_wrapper = array( 'class' => 'mermaid-blocks-diagram' );

// The controls visitors get. The front-end script adds them to the rendered diagram.
$mermaid_blocks_controls = array();
foreach ( array( 'zoom', 'download' ) as $mermaid_blocks_control ) {
	if ( ! empty( $attributes[ $mermaid_blocks_control ] ) ) {
		$mermaid_blocks_controls[] = $mermaid_blocks_control;
	}
}

if ( $mermaid_blocks_controls ) {
	$mermaid_blocks_wrapper['data-mermaid-controls'] = implode( ' ', $mermaid_blocks_controls );
}
?>
<div <?php echo get_block_wrapper_attributes( $mermaid_blocks_wrapper ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped by core. ?>>
	<?php echo mermaid_blocks_get_diagram_source_markup( $mermaid_blocks_code ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the function. ?>
</div>
