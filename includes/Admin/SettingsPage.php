<?php
/**
 * The plugin's settings page, under Settings > Mermaid Blocks.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Admin;

use MermaidBlocks\Files;
use MermaidBlocks\Hookable;
use MermaidBlocks\Options;
use MermaidBlocks\Renderers;
use MermaidBlocks\Themes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The settings page. It has the theme diagrams are drawn in unless a diagram
 * has its own, and a switch for each optional part of the plugin. Each
 * setting is stored in an option: Options reads them, on any request, and
 * `uninstall.php` deletes them.
 */
final class SettingsPage implements Hookable {

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
	 * The stored settings.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * The plugin's files, to find its row in the list of plugins.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * Sets up the settings page.
	 *
	 * @param Options $options The stored settings.
	 * @param Themes  $themes  The themes a diagram can be drawn in.
	 * @param Files   $files   The plugin's files.
	 */
	public function __construct( Options $options, Themes $themes, Files $files ) {
		$this->options = $options;
		$this->themes  = $themes;
		$this->files   = $files;
	}

	/**
	 * Adds the settings page and its settings to WordPress.
	 */
	public function hooks(): void {
		add_action( 'admin_init', array( $this, 'register' ) );
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_filter( 'plugin_action_links_' . $this->files->get_basename(), array( $this, 'add_action_link' ) );
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
	 * Registers the renderer and the theme settings and their fields on the
	 * settings page, then the switches of the optional parts of the plugin, then lets other code add
	 * its own.
	 */
	public function register(): void {
		/*
		 * Stored even when it was never changed: reading an option that doesn't
		 * exist takes a query, on every page that shows a diagram.
		 */
		if ( false === get_option( Options::RENDERER, false ) ) {
			add_option( Options::RENDERER, Renderers::MERMAID );
		}

		if ( false === get_option( Options::THEME, false ) ) {
			add_option( Options::THEME, Themes::AUTO );
		}

		register_setting(
			self::GROUP,
			Options::RENDERER,
			array(
				'type'              => 'string',
				'sanitize_callback' => array( Renderers::class, 'sanitize' ),
				'default'           => Renderers::MERMAID,
			)
		);

		register_setting(
			self::GROUP,
			Options::THEME,
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
			Options::RENDERER,
			__( 'Renderer', 'mermaid-blocks' ),
			array( $this, 'render_renderer_field' ),
			self::PAGE,
			self::SECTION
		);

		add_settings_field(
			Options::THEME,
			__( 'Theme', 'mermaid-blocks' ),
			array( $this, 'render_theme_field' ),
			self::PAGE,
			self::SECTION,
			array( 'label_for' => Options::THEME )
		);

		foreach ( $this->get_switches() as $option => $switch ) {
			$this->add_switch( $option, $switch['title'], $switch['label'], $switch['description'] );
		}

		/**
		 * Fires once the settings page has the plugin's settings, for what adds
		 * a setting of its own: see SettingsPage::add_switch().
		 *
		 * @param SettingsPage $settings_page The settings page.
		 */
		do_action( 'mermaid_blocks_register_settings', $this );
	}

	/**
	 * Returns the switches of the optional parts of the plugin, in the order
	 * the page shows them.
	 *
	 * A new one also needs its option in Options::ALL and in `uninstall.php`.
	 *
	 * @return array[] The title, the label and the description of each
	 *                 switch, by its option: see add_switch().
	 */
	private function get_switches(): array {
		return array(
			Options::CODE_BLOCKS => array(
				'title'       => __( 'Code blocks', 'mermaid-blocks' ),
				'label'       => __( 'Show code marked as Mermaid as diagrams', 'mermaid-blocks' ),
				'description' => __( 'Turns code with the <code>language-mermaid</code> class, such as Markdown code blocks, into diagrams for visitors. The editor still shows the code.', 'mermaid-blocks' ),
			),
			Options::SAVE_IMAGES => array(
				'title'       => __( 'Saved images', 'mermaid-blocks' ),
				'label'       => __( 'Save an image of each diagram', 'mermaid-blocks' ),
				'description' => __( 'Feeds and browsers without JavaScript show the image instead of the code. The block editor saves it when you open or save a post.', 'mermaid-blocks' ),
			),
		);
	}

	/**
	 * Adds a setting that is on or off, with its checkbox on the settings page.
	 *
	 * The plugin's own are in get_switches(). Other code adds one on the
	 * `mermaid_blocks_register_settings` action, reads it with
	 * Options::is_on(), and deletes its option when it is uninstalled.
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
	 * Outputs the field of the renderer setting: a radio button for each.
	 */
	public function render_renderer_field(): void {
		$labels = array(
			Renderers::MERMAID => __( 'Mermaid.js', 'mermaid-blocks' ),
			Renderers::PELE    => __( 'Pele', 'mermaid-blocks' ),
		);
		$stored = $this->options->get_site_renderer();
		?>
		<fieldset aria-describedby="mermaid_blocks_renderer_description">
			<legend class="screen-reader-text"><span><?php esc_html_e( 'Renderer', 'mermaid-blocks' ); ?></span></legend>
			<?php foreach ( $labels as $name => $label ) : ?>
				<label>
					<input type="radio" name="<?php echo esc_attr( Options::RENDERER ); ?>" value="<?php echo esc_attr( $name ); ?>" <?php checked( $stored, $name ); ?>>
					<?php echo esc_html( $label ); ?>
				</label>
				<br>
			<?php endforeach; ?>
			<p class="description" id="mermaid_blocks_renderer_description">
				<?php esc_html_e( 'Draws every diagram of the site. Pele loads less and draws faster, in a plain look of its own: themes then count as light or dark.', 'mermaid-blocks' ); ?>
			</p>
		</fieldset>
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
	 * Outputs the field of the theme setting: the themes offered with the
	 * site's renderer.
	 *
	 * A site's theme that isn't offered is shown as the one it is drawn as,
	 * whose option then submits the site's theme: saving the page as it is
	 * keeps it.
	 */
	public function render_theme_field(): void {
		$current = $this->themes->get_site_theme();
		$shown   = $this->themes->get_shown( $current );
		?>
		<select id="<?php echo esc_attr( Options::THEME ); ?>" name="<?php echo esc_attr( Options::THEME ); ?>" aria-describedby="mermaid_blocks_theme_description">
			<?php foreach ( $this->themes->get_offered() as $name => $label ) : ?>
				<option value="<?php echo esc_attr( $shown === $name ? $current : $name ); ?>" <?php selected( $shown, $name ); ?>><?php echo esc_html( $label ); ?></option>
			<?php endforeach; ?>
		</select>
		<p class="description" id="mermaid_blocks_theme_description">
			<?php esc_html_e( 'Automatic turns dark on dark backgrounds. Each diagram block can use its own theme.', 'mermaid-blocks' ); ?>
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
				<input type="checkbox" id="<?php echo esc_attr( $option ); ?>" name="<?php echo esc_attr( $option ); ?>" value="1" <?php checked( $this->options->is_on( $option ) ); ?><?php echo '' === $description ? '' : ' aria-describedby="' . esc_attr( $option ) . '_description"'; ?>>
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
