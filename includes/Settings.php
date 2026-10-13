<?php
/**
 * The plugin's settings page, under Settings > Mermaid Blocks.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The settings page. It has the theme diagrams are drawn in unless a diagram
 * has its own, and a switch for each optional part of the plugin, which that
 * part adds: see add_switch(). Each setting is stored in an option, which
 * `uninstall.php` deletes.
 */
final class Settings {

	/**
	 * The slug of the settings page.
	 */
	const PAGE = 'mermaid-blocks';

	/**
	 * The group the setting is registered in.
	 */
	const GROUP = 'mermaid_blocks';

	/**
	 * The section of the settings page that holds the settings.
	 */
	const SECTION = 'mermaid_blocks_diagrams';

	/**
	 * The option that holds the site's theme.
	 */
	const THEME_OPTION = 'mermaid_blocks_theme';

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * The main file of the plugin.
	 *
	 * @var string
	 */
	private string $plugin_file;

	/**
	 * Sets up the settings.
	 *
	 * @param Themes $themes      The themes a diagram can be drawn in.
	 * @param string $plugin_file The main file of the plugin.
	 */
	public function __construct( Themes $themes, string $plugin_file ) {
		$this->themes      = $themes;
		$this->plugin_file = $plugin_file;
	}

	/**
	 * Adds the settings page and its setting to WordPress.
	 */
	public function hooks(): void {
		add_action( 'admin_init', array( $this, 'register' ) );
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( $this->plugin_file ), array( $this, 'add_action_link' ) );
	}

	/**
	 * Returns the site's theme, which diagrams without a theme of their own
	 * are drawn in.
	 *
	 * @return string A name from Themes::get_all().
	 */
	public function get_theme(): string {
		$theme = get_option( self::THEME_OPTION, Themes::AUTO );

		return $this->themes->exists( $theme ) ? $theme : Themes::AUTO;
	}

	/**
	 * Tells whether a setting that is on or off is on: see add_switch().
	 *
	 * @param string $option The option that holds the setting.
	 *
	 * @return bool Whether it is on. A setting that was never saved is off.
	 */
	public function is_on( string $option ): bool {
		return (bool) get_option( $option, false );
	}

	/**
	 * Returns the URL of the settings page.
	 *
	 * @return string The URL.
	 */
	public function get_url(): string {
		return admin_url( 'options-general.php?page=' . self::PAGE );
	}

	/**
	 * Registers the theme setting and its field on the settings page, then lets
	 * the optional parts of the plugin add their switches.
	 */
	public function register(): void {
		/*
		 * Stored even when it was never changed: reading an option that doesn't
		 * exist takes a query, on every page that shows a diagram.
		 */
		if ( false === get_option( self::THEME_OPTION, false ) ) {
			add_option( self::THEME_OPTION, Themes::AUTO );
		}

		register_setting(
			self::GROUP,
			self::THEME_OPTION,
			array(
				'type'              => 'string',
				'sanitize_callback' => array( $this, 'sanitize_theme' ),
				'default'           => Themes::AUTO,
			)
		);

		add_settings_section(
			self::SECTION,
			__( 'Diagrams', 'mermaid-blocks' ),
			'__return_null',
			self::PAGE
		);

		add_settings_field(
			self::THEME_OPTION,
			__( 'Theme', 'mermaid-blocks' ),
			array( $this, 'render_theme_field' ),
			self::PAGE,
			self::SECTION,
			array( 'label_for' => self::THEME_OPTION )
		);

		/**
		 * Fires once the settings page has its theme setting, for what adds a
		 * setting of its own: see Settings::add_switch().
		 *
		 * @param Settings $settings The settings.
		 */
		do_action( 'mermaid_blocks_register_settings', $this );
	}

	/**
	 * Adds a setting that is on or off, with its checkbox on the settings page.
	 *
	 * For the optional parts of the plugin: each adds its switch on the
	 * `mermaid_blocks_register_settings` action, reads it with is_on(), and
	 * has its option deleted in `uninstall.php`.
	 *
	 * @param string $option      The option that holds the setting.
	 * @param string $title       The title of the setting.
	 * @param string $label       The label of the checkbox: what switching it
	 *                            on does.
	 * @param string $description Optional. More about it, shown under the
	 *                            checkbox. It may contain `<code>` elements.
	 */
	public function add_switch( string $option, string $title, string $label, string $description = '' ): void {
		// Stored even when it was never changed, as the theme is: see register().
		if ( false === get_option( $option, false ) ) {
			add_option( $option, 0 );
		}

		register_setting(
			self::GROUP,
			$option,
			array(
				'type'              => 'boolean',
				'sanitize_callback' => array( $this, 'sanitize_switch' ),
				'default'           => false,
			)
		);

		add_settings_field(
			$option,
			$title,
			array( $this, 'render_switch' ),
			self::PAGE,
			self::SECTION,
			array(
				'option'      => $option,
				'title'       => $title,
				'label'       => $label,
				'description' => $description,
			)
		);
	}

	/**
	 * Adds the settings page to the Settings menu.
	 */
	public function add_page(): void {
		add_options_page(
			__( 'Mermaid Blocks', 'mermaid-blocks' ),
			__( 'Mermaid Blocks', 'mermaid-blocks' ),
			'manage_options',
			self::PAGE,
			array( $this, 'render_page' )
		);
	}

	/**
	 * Outputs the settings page.
	 */
	public function render_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form action="options.php" method="post">
				<?php
				settings_fields( self::GROUP );
				do_settings_sections( self::PAGE );
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
	 * @return string A name from Themes::get_all().
	 */
	public function sanitize_theme( $value ): string {
		return $this->themes->exists( $value ) ? $value : Themes::AUTO;
	}

	/**
	 * Outputs the field of the theme setting.
	 */
	public function render_theme_field(): void {
		$current = $this->get_theme();
		?>
		<select id="<?php echo esc_attr( self::THEME_OPTION ); ?>" name="<?php echo esc_attr( self::THEME_OPTION ); ?>" aria-describedby="mermaid_blocks_theme_description">
			<?php foreach ( $this->themes->get_all() as $name => $label ) : ?>
				<option value="<?php echo esc_attr( $name ); ?>" <?php selected( $current, $name ); ?>><?php echo esc_html( $label ); ?></option>
			<?php endforeach; ?>
		</select>
		<p class="description" id="mermaid_blocks_theme_description">
			<?php esc_html_e( 'Automatic is the theme Mermaid picks for each type of diagram, or its dark counterpart where the diagram sits on a dark background. A diagram block can have a theme of its own.', 'mermaid-blocks' ); ?>
		</p>
		<?php
	}

	/**
	 * Sanitizes a setting that is on or off.
	 *
	 * @param mixed $value The submitted value: nothing for a checkbox that isn't
	 *                     ticked.
	 *
	 * @return int 1 for on, 0 for off.
	 */
	public function sanitize_switch( $value ): int {
		return empty( $value ) ? 0 : 1;
	}

	/**
	 * Outputs the checkbox of a setting that is on or off.
	 *
	 * @param array $args The option, the title, the label and the description
	 *                    add_switch() was given.
	 */
	public function render_switch( $args ): void {
		$option      = (string) $args['option'];
		$description = (string) $args['description'];
		?>
		<fieldset>
			<legend class="screen-reader-text"><span><?php echo esc_html( $args['title'] ); ?></span></legend>
			<label for="<?php echo esc_attr( $option ); ?>">
				<input type="checkbox" id="<?php echo esc_attr( $option ); ?>" name="<?php echo esc_attr( $option ); ?>" value="1" <?php checked( $this->is_on( $option ) ); ?><?php echo '' === $description ? '' : ' aria-describedby="' . esc_attr( $option ) . '_description"'; ?>>
				<?php echo esc_html( $args['label'] ); ?>
			</label>
			<?php if ( '' !== $description ) : ?>
				<p class="description" id="<?php echo esc_attr( $option ); ?>_description">
					<?php echo wp_kses( $description, array( 'code' => array() ) ); ?>
				</p>
			<?php endif; ?>
		</fieldset>
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
	public function add_action_link( $links ): array {
		$links = (array) $links;
		$link  = sprintf(
			'<a href="%s">%s</a>',
			esc_url( $this->get_url() ),
			esc_html__( 'Settings', 'mermaid-blocks' )
		);

		array_unshift( $links, $link );

		return $links;
	}
}
