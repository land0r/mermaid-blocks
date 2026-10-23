<?php
/**
 * Tests of the settings page.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Admin\SettingsPage;
use MermaidBlocks\Files;
use MermaidBlocks\Options;
use MermaidBlocks\Themes;
use WP_UnitTestCase;

/**
 * The settings page: its theme setting, the switches of the optional parts
 * of the plugin, and those other code adds.
 *
 * @covers \MermaidBlocks\Admin\SettingsPage
 */
class SettingsPageTest extends WP_UnitTestCase {

	/**
	 * The option of the switch the tests add.
	 */
	const OPTION = 'mermaid_blocks_test_switch';

	/**
	 * The settings page.
	 *
	 * @var SettingsPage
	 */
	private SettingsPage $settings;

	/**
	 * The stored settings.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * Loads what registers the fields of a settings page: WordPress has it
	 * only in the admin.
	 */
	public function set_up(): void {
		parent::set_up();

		require_once ABSPATH . 'wp-admin/includes/template.php';

		$this->settings = mermaid_blocks()->get( SettingsPage::class );
		$this->options  = mermaid_blocks()->get( Options::class );
	}

	/**
	 * Forgets the settings and the fields: both outlive a test.
	 */
	public function tear_down(): void {
		global $wp_settings_sections, $wp_settings_fields;

		foreach ( get_registered_settings() as $option => $setting ) {
			if ( SettingsPage::GROUP === $setting['group'] ) {
				unregister_setting( SettingsPage::GROUP, $option );
			}
		}

		unset( $wp_settings_sections[ SettingsPage::PAGE ], $wp_settings_fields[ SettingsPage::PAGE ] );

		parent::tear_down();
	}

	/**
	 * Adds the switch of the tests.
	 *
	 * @param string $description Its description.
	 */
	private function add_switch( string $description = '' ): void {
		$this->settings->add_switch( self::OPTION, 'Test switch', 'Switch the test on', $description );
	}

	/**
	 * Returns the checkbox of the switch of the tests, as the page outputs it.
	 *
	 * @param string $description The description of the switch.
	 *
	 * @return string The markup.
	 */
	private function render_switch( string $description = '' ): string {
		return get_echo(
			array( $this->settings, 'render_switch' ),
			array(
				array(
					'option'      => self::OPTION,
					'title'       => 'Test switch',
					'label'       => 'Switch the test on',
					'description' => $description,
				),
			)
		);
	}

	/**
	 * The page has a switch for each optional part of the plugin, after the
	 * theme: every option of the plugin is a setting of the page.
	 */
	public function test_has_the_switches_of_the_optional_parts(): void {
		global $wp_settings_fields;

		$this->settings->register();

		$this->assertSame(
			array( Options::RENDERER, Options::THEME, Options::CODE_BLOCKS, Options::SAVE_IMAGES ),
			array_keys( $wp_settings_fields[ SettingsPage::PAGE ][ SettingsPage::SECTION ] )
		);

		$registered = get_registered_settings();

		foreach ( Options::ALL as $option ) {
			$this->assertSame( SettingsPage::GROUP, $registered[ $option ]['group'] ?? null, $option );
		}

		foreach ( array( Options::CODE_BLOCKS, Options::SAVE_IMAGES ) as $option ) {
			$field = $wp_settings_fields[ SettingsPage::PAGE ][ SettingsPage::SECTION ][ $option ];

			$this->assertNotEmpty( $field['title'], $option );
			$this->assertNotEmpty( $field['args']['label'], $option );
			$this->assertNotEmpty( $field['args']['description'], $option );
			$this->assertSame( '0', (string) get_option( $option, 'missing' ), $option );
		}
	}

	/**
	 * The renderer is the first field, stored from the start, with Mermaid.js
	 * as its default.
	 */
	public function test_the_renderer_comes_first_and_is_mermaid_by_default(): void {
		global $wp_settings_fields;

		delete_option( Options::RENDERER );
		$this->settings->register();

		$fields = array_keys( $wp_settings_fields[ SettingsPage::PAGE ][ SettingsPage::SECTION ] );

		$this->assertSame( Options::RENDERER, $fields[0] );
		$this->assertSame( 'mermaid', get_option( Options::RENDERER, 'missing' ) );
		$this->assertSame( 'mermaid', get_registered_settings()[ Options::RENDERER ]['default'] );
	}

	/**
	 * Only a known renderer is kept.
	 */
	public function test_keeps_only_a_known_renderer(): void {
		$this->assertSame( 'pele', $this->settings->sanitize_renderer( 'pele' ) );
		$this->assertSame( 'mermaid', $this->settings->sanitize_renderer( 'mermaid' ) );
		$this->assertSame( 'mermaid', $this->settings->sanitize_renderer( 'other' ) );
		$this->assertSame( 'mermaid', $this->settings->sanitize_renderer( array( 'pele' ) ) );
		$this->assertSame( 'mermaid', $this->settings->sanitize_renderer( null ) );
	}

	/**
	 * The field is two radio buttons, the stored renderer checked, and a line
	 * of help that says what Pele changes.
	 */
	public function test_shows_the_renderer_as_radio_buttons(): void {
		update_option( Options::RENDERER, 'pele' );

		$markup = get_echo( array( $this->settings, 'render_renderer_field' ) );

		$this->assertSame( 2, substr_count( $markup, 'type="radio"' ) );
		$this->assertStringContainsString( 'name="mermaid_blocks_renderer" value="mermaid"', $markup );
		$this->assertMatchesRegularExpression( '/value="pele"\s+checked=\'checked\'/', $markup );
		$this->assertDoesNotMatchRegularExpression( '/value="mermaid"\s+checked/', $markup );
		$this->assertStringContainsString( 'Mermaid.js', $markup );
		$this->assertStringContainsString( 'Pele loads less and draws faster', $markup );

		update_option( Options::RENDERER, 'nonsense' );
		$markup = get_echo( array( $this->settings, 'render_renderer_field' ) );

		$this->assertMatchesRegularExpression( '/value="mermaid"\s+checked=\'checked\'/', $markup );
	}

	/**
	 * The page asks for the switches of other code once it has its own, so
	 * they come last.
	 */
	public function test_asks_for_switches_after_its_own(): void {
		global $wp_settings_fields;

		$given = null;
		add_action(
			'mermaid_blocks_register_settings',
			function ( $settings ) use ( &$given ) {
				$given = $settings;
				$this->add_switch();
			}
		);

		$this->settings->register();

		$fields = array_keys( $wp_settings_fields[ SettingsPage::PAGE ][ SettingsPage::SECTION ] );

		$this->assertSame( $this->settings, $given );
		$this->assertSame( Options::RENDERER, $fields[0] );
		$this->assertSame( self::OPTION, end( $fields ) );
	}

	/**
	 * A switch is a registered setting of the page, off until it is switched
	 * on, and stored from the start: reading an option that doesn't exist
	 * takes a query.
	 */
	public function test_adds_a_switch(): void {
		$this->assertFalse( $this->options->is_on( self::OPTION ) );

		$this->add_switch();

		$registered = get_registered_settings();

		$this->assertArrayHasKey( self::OPTION, $registered );
		$this->assertSame( SettingsPage::GROUP, $registered[ self::OPTION ]['group'] );
		$this->assertSame( 'boolean', $registered[ self::OPTION ]['type'] );
		$this->assertSame( '0', (string) get_option( self::OPTION, 'missing' ) );
		$this->assertFalse( $this->options->is_on( self::OPTION ) );
	}

	/**
	 * Adding a switch again leaves what it was set to.
	 */
	public function test_keeps_a_switch_that_is_on(): void {
		$this->add_switch();
		update_option( self::OPTION, '1' );

		$this->add_switch();

		$this->assertTrue( $this->options->is_on( self::OPTION ) );
	}

	/**
	 * Submitted values, with whether they switch the setting on.
	 *
	 * @return array[] The value, and whether the switch is on.
	 */
	public function data_switch_values(): array {
		return array(
			'ticked'       => array( '1', true ),
			'not ticked'   => array( null, false ),
			'empty'        => array( '', false ),
			'zero'         => array( '0', false ),
			'another word' => array( 'on', true ),
		);
	}

	/**
	 * A switch is stored as 1 or 0, whatever was submitted. A checkbox that
	 * isn't ticked submits nothing.
	 *
	 * @dataProvider data_switch_values
	 *
	 * @param mixed $value The submitted value.
	 * @param bool  $is_on Whether the switch is on.
	 */
	public function test_stores_a_switch_as_on_or_off( $value, bool $is_on ): void {
		$this->add_switch();
		update_option( self::OPTION, $is_on ? 0 : 1 );

		update_option( self::OPTION, $value );

		$this->assertSame( $is_on ? '1' : '0', (string) get_option( self::OPTION ) );
		$this->assertSame( $is_on, $this->options->is_on( self::OPTION ) );
	}

	/**
	 * The checkbox has the label and the title, and is ticked when the switch
	 * is on.
	 */
	public function test_outputs_the_checkbox(): void {
		$this->add_switch();

		$markup = $this->render_switch();

		$this->assertStringContainsString( '<input type="checkbox" id="' . self::OPTION . '" name="' . self::OPTION . '" value="1" >', $markup );
		$this->assertStringContainsString( 'Switch the test on', $markup );
		$this->assertStringContainsString( '<legend class="screen-reader-text"><span>Test switch</span></legend>', $markup );
		$this->assertStringNotContainsString( 'description', $markup );

		update_option( self::OPTION, '1' );

		$this->assertStringContainsString( " checked='checked'", $this->render_switch() );
	}

	/**
	 * The description is tied to the checkbox, and keeps its code elements
	 * and nothing else.
	 */
	public function test_outputs_the_description(): void {
		$markup = $this->render_switch( 'With the <code>language-x</code> class. <script>alert( 1 )</script><a href="#">More</a>' );

		$this->assertStringContainsString( ' aria-describedby="' . self::OPTION . '_description"', $markup );
		$this->assertStringContainsString( '<p class="description" id="' . self::OPTION . '_description">', $markup );
		$this->assertStringContainsString( 'With the <code>language-x</code> class.', $markup );
		$this->assertStringNotContainsString( '<script', $markup );
		$this->assertStringNotContainsString( '<a ', $markup );
	}

	/**
	 * The theme setting is stored from the start, as Automatic, and only the
	 * name of a theme is stored in it.
	 */
	public function test_stores_only_a_known_theme(): void {
		delete_option( Options::THEME );

		$this->settings->register();

		$this->assertSame( Themes::AUTO, get_option( Options::THEME, 'missing' ) );

		update_option( Options::THEME, 'forest' );
		$this->assertSame( 'forest', get_option( Options::THEME ) );

		update_option( Options::THEME, 'no-such-theme' );
		$this->assertSame( Themes::AUTO, get_option( Options::THEME ) );
	}

	/**
	 * The field of the theme offers every theme, with the site's selected.
	 */
	public function test_outputs_the_themes(): void {
		update_option( Options::THEME, 'forest' );

		$markup = get_echo( array( $this->settings, 'render_theme_field' ) );

		foreach ( mermaid_blocks()->themes()->get_all() as $name => $label ) {
			$this->assertStringContainsString( '<option value="' . $name . '" ' . ( 'forest' === $name ? " selected='selected'" : '' ) . '>' . $label . '</option>', $markup );
		}
	}

	/**
	 * The page is in the admin: its hooks are those of the admin, and the row
	 * of the plugin in the list of plugins links to it.
	 */
	public function test_adds_the_page_to_the_admin(): void {
		$this->settings->hooks();

		$this->assertSame( 10, has_action( 'admin_init', array( $this->settings, 'register' ) ) );
		$this->assertSame( 10, has_action( 'admin_menu', array( $this->settings, 'add_page' ) ) );

		$basename = mermaid_blocks()->get( Files::class )->get_basename();
		$links    = apply_filters( 'plugin_action_links_' . $basename, array( 'deactivate' => '<a>Deactivate</a>' ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- A hook of WordPress.

		$this->assertSame( '<a href="' . esc_url( $this->settings->get_url() ) . '">Settings</a>', reset( $links ) );
		$this->assertSame( admin_url( 'options-general.php?page=mermaid-blocks' ), $this->settings->get_url() );
		$this->assertCount( 2, $links );
	}
}
