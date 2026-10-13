<?php
/**
 * Tests of the settings.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Settings;
use MermaidBlocks\Themes;
use WP_UnitTestCase;

/**
 * The settings page: its theme setting, and the switches other parts add.
 *
 * @covers \MermaidBlocks\Settings
 */
class SettingsTest extends WP_UnitTestCase {

	/**
	 * The option of the switch the tests add.
	 */
	const OPTION = 'mermaid_blocks_test_switch';

	/**
	 * The settings.
	 *
	 * @var Settings
	 */
	private Settings $settings;

	/**
	 * Loads what registers the fields of a settings page: WordPress has it
	 * only in the admin.
	 */
	public function set_up(): void {
		parent::set_up();

		require_once ABSPATH . 'wp-admin/includes/template.php';

		$this->settings = mermaid_blocks()->settings();
	}

	/**
	 * Forgets the settings and the fields: both outlive a test.
	 */
	public function tear_down(): void {
		global $wp_settings_sections, $wp_settings_fields;

		foreach ( get_registered_settings() as $option => $setting ) {
			if ( Settings::GROUP === $setting['group'] ) {
				unregister_setting( Settings::GROUP, $option );
			}
		}

		unset( $wp_settings_sections[ Settings::PAGE ], $wp_settings_fields[ Settings::PAGE ] );

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
	 * The page asks for switches once it has its theme setting, so they come
	 * after it.
	 */
	public function test_asks_for_switches_after_the_theme(): void {
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

		$fields = array_keys( $wp_settings_fields[ Settings::PAGE ][ Settings::SECTION ] );

		$this->assertSame( $this->settings, $given );
		$this->assertSame( Settings::THEME_OPTION, $fields[0] );
		$this->assertContains( self::OPTION, $fields );
	}

	/**
	 * A switch is a registered setting of the page, off until it is switched
	 * on, and stored from the start: reading an option that doesn't exist
	 * takes a query.
	 */
	public function test_adds_a_switch(): void {
		$this->assertFalse( $this->settings->is_on( self::OPTION ) );

		$this->add_switch();

		$registered = get_registered_settings();

		$this->assertArrayHasKey( self::OPTION, $registered );
		$this->assertSame( Settings::GROUP, $registered[ self::OPTION ]['group'] );
		$this->assertSame( 'boolean', $registered[ self::OPTION ]['type'] );
		$this->assertSame( '0', (string) get_option( self::OPTION, 'missing' ) );
		$this->assertFalse( $this->settings->is_on( self::OPTION ) );
	}

	/**
	 * Adding a switch again leaves what it was set to.
	 */
	public function test_keeps_a_switch_that_is_on(): void {
		$this->add_switch();
		update_option( self::OPTION, '1' );

		$this->add_switch();

		$this->assertTrue( $this->settings->is_on( self::OPTION ) );
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
		$this->assertSame( $is_on, $this->settings->is_on( self::OPTION ) );
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
	 * The theme setting is still the site's theme, and an unknown one is
	 * Automatic.
	 */
	public function test_keeps_the_theme_setting(): void {
		$this->settings->register();

		update_option( Settings::THEME_OPTION, 'forest' );
		$this->assertSame( 'forest', $this->settings->get_theme() );

		update_option( Settings::THEME_OPTION, 'no-such-theme' );
		$this->assertSame( Themes::AUTO, $this->settings->get_theme() );
	}
}
