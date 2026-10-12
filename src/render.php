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

$mermaid_blocks_wrapper = array(
	'class'              => 'mermaid-blocks-diagram',
	// The block's own theme, or else the site's.
	'data-mermaid-theme' => mermaid_blocks_get_diagram_theme( isset( $attributes['theme'] ) ? $attributes['theme'] : '' ),
);

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

// What assistive technology reads for the diagram. The front-end script writes both into the rendered SVG.
$mermaid_blocks_texts = array(
	'accTitle' => 'data-mermaid-title',
	'accDescr' => 'data-mermaid-description',
);
foreach ( $mermaid_blocks_texts as $mermaid_blocks_text => $mermaid_blocks_name ) {
	$mermaid_blocks_value = isset( $attributes[ $mermaid_blocks_text ] ) ? trim( (string) $attributes[ $mermaid_blocks_text ] ) : '';

	if ( '' !== $mermaid_blocks_value ) {
		$mermaid_blocks_wrapper[ $mermaid_blocks_name ] = $mermaid_blocks_value;
	}
}

// A diagram with a caption is a figure.
$mermaid_blocks_caption = mermaid_blocks_get_diagram_caption_markup( isset( $attributes['caption'] ) ? $attributes['caption'] : '' );
$mermaid_blocks_tag     = '' === $mermaid_blocks_caption ? 'div' : 'figure';
?>
<<?php echo tag_escape( $mermaid_blocks_tag ); ?> <?php echo mermaid_blocks_encode_brackets( get_block_wrapper_attributes( $mermaid_blocks_wrapper ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped by core. ?>>
	<?php echo mermaid_blocks_get_diagram_source_markup( $mermaid_blocks_code ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the function. ?>
	<?php echo $mermaid_blocks_caption; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in the function. ?>
</<?php echo tag_escape( $mermaid_blocks_tag ); ?>>
