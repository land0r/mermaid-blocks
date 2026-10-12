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
 * The settings page, and its one setting: the theme diagrams are drawn in
 * unless a diagram has its own. It is stored in an option, which
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
	 * Returns the URL of the settings page.
	 *
	 * @return string The URL.
	 */
	public function get_url(): string {
		return admin_url( 'options-general.php?page=' . self::PAGE );
	}

	/**
	 * Registers the setting, and its field on the settings page.
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
			'mermaid_blocks_diagrams',
			__( 'Diagrams', 'mermaid-blocks' ),
			'__return_null',
			self::PAGE
		);

		add_settings_field(
			self::THEME_OPTION,
			__( 'Theme', 'mermaid-blocks' ),
			array( $this, 'render_theme_field' ),
			self::PAGE,
			'mermaid_blocks_diagrams',
			array( 'label_for' => self::THEME_OPTION )
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
