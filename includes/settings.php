<?php
/**
 * The plugin's settings page, under Settings > Mermaid Blocks.
 *
 * It has one setting: the theme diagrams are drawn in unless a diagram has
 * its own. It is stored in the `mermaid_blocks_theme` option and read with
 * mermaid_blocks_get_diagram_theme().
 *
 * @package MermaidBlocks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Returns the URL of the settings page.
 *
 * @return string The URL.
 */
function mermaid_blocks_get_settings_url() {
	return admin_url( 'options-general.php?page=mermaid-blocks' );
}

/**
 * Registers the setting, and its field on the settings page.
 */
function mermaid_blocks_register_settings() {
	/*
	 * Stored even when it was never changed: reading an option that doesn't
	 * exist takes a query, on every page that shows a diagram.
	 */
	if ( false === get_option( 'mermaid_blocks_theme', false ) ) {
		add_option( 'mermaid_blocks_theme', 'auto' );
	}

	register_setting(
		'mermaid_blocks',
		'mermaid_blocks_theme',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'mermaid_blocks_sanitize_theme',
			'default'           => 'auto',
		)
	);

	add_settings_section(
		'mermaid_blocks_diagrams',
		__( 'Diagrams', 'mermaid-blocks' ),
		'__return_null',
		'mermaid-blocks'
	);

	add_settings_field(
		'mermaid_blocks_theme',
		__( 'Theme', 'mermaid-blocks' ),
		'mermaid_blocks_render_theme_field',
		'mermaid-blocks',
		'mermaid_blocks_diagrams',
		array( 'label_for' => 'mermaid_blocks_theme' )
	);
}
add_action( 'admin_init', 'mermaid_blocks_register_settings' );

/**
 * Adds the settings page to the Settings menu.
 */
function mermaid_blocks_add_settings_page() {
	add_options_page(
		__( 'Mermaid Blocks', 'mermaid-blocks' ),
		__( 'Mermaid Blocks', 'mermaid-blocks' ),
		'manage_options',
		'mermaid-blocks',
		'mermaid_blocks_render_settings_page'
	);
}
add_action( 'admin_menu', 'mermaid_blocks_add_settings_page' );

/**
 * Outputs the settings page.
 */
function mermaid_blocks_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'mermaid_blocks' );
			do_settings_sections( 'mermaid-blocks' );
			submit_button();
			?>
		</form>
	</div>
	<?php
}

/**
 * Sanitizes the theme setting.
 *
 * @param mixed $value The submitted value.
 *
 * @return string A name from mermaid_blocks_get_themes().
 */
function mermaid_blocks_sanitize_theme( $value ) {
	$themes = mermaid_blocks_get_themes();

	return is_string( $value ) && isset( $themes[ $value ] ) ? $value : 'auto';
}

/**
 * Outputs the field of the theme setting.
 */
function mermaid_blocks_render_theme_field() {
	$current = mermaid_blocks_get_diagram_theme();
	?>
	<select id="mermaid_blocks_theme" name="mermaid_blocks_theme" aria-describedby="mermaid_blocks_theme_description">
		<?php foreach ( mermaid_blocks_get_themes() as $name => $label ) : ?>
			<option value="<?php echo esc_attr( $name ); ?>" <?php selected( $current, $name ); ?>><?php echo esc_html( $label ); ?></option>
		<?php endforeach; ?>
	</select>
	<p class="description" id="mermaid_blocks_theme_description">
		<?php esc_html_e( 'Automatic is the theme Mermaid picks for each type of diagram, or its dark counterpart where the diagram sits on a dark background. A diagram block can have a theme of its own.', 'mermaid-blocks' ); ?>
	</p>
	<?php
}

/**
 * Adds a link to the settings page to the plugin's row in the list of
 * plugins.
 *
 * @param array $links The links of the row.
 *
 * @return array The links, with Settings first.
 */
function mermaid_blocks_add_settings_link( $links ) {
	$link = sprintf(
		'<a href="%s">%s</a>',
		esc_url( mermaid_blocks_get_settings_url() ),
		esc_html__( 'Settings', 'mermaid-blocks' )
	);

	array_unshift( $links, $link );

	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( MERMAID_BLOCKS_PLUGIN_FILE ), 'mermaid_blocks_add_settings_link' );
