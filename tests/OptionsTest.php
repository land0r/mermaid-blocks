<?php
/**
 * Tests of the stored settings.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Options;
use ReflectionClass;
use WP_UnitTestCase;

/**
 * What the plugin's settings are set to, and that they are all deleted with
 * the plugin.
 *
 * @covers \MermaidBlocks\Options
 */
class OptionsTest extends WP_UnitTestCase {

	/**
	 * The stored settings.
	 *
	 * @var Options
	 */
	private Options $options;

	/**
	 * Gets the stored settings.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->options = mermaid_blocks()->get( Options::class );
	}

	/**
	 * The theme is given as it is stored: whether it is one is for Themes to
	 * tell. Nothing, or something that isn't text, is no theme.
	 */
	public function test_reads_the_theme_as_it_is_stored(): void {
		delete_option( Options::THEME );
		$this->assertSame( '', $this->options->get_theme() );

		update_option( Options::THEME, 'forest' );
		$this->assertSame( 'forest', $this->options->get_theme() );

		update_option( Options::THEME, 'no-such-theme' );
		$this->assertSame( 'no-such-theme', $this->options->get_theme() );

		update_option( Options::THEME, array( 'forest' ) );
		$this->assertSame( '', $this->options->get_theme() );
	}

	/**
	 * Stored values, with whether the switch is on.
	 *
	 * @return array[] The value, and whether the switch is on.
	 */
	public function data_switch_values(): array {
		return array(
			'on'             => array( 1, true ),
			'on, as text'    => array( '1', true ),
			'off'            => array( 0, false ),
			'off, as text'   => array( '0', false ),
			'an empty value' => array( '', false ),
		);
	}

	/**
	 * A switch is on when its option holds something.
	 *
	 * @dataProvider data_switch_values
	 *
	 * @param mixed $value The stored value.
	 * @param bool  $is_on Whether the switch is on.
	 */
	public function test_tells_whether_a_switch_is_on( $value, bool $is_on ): void {
		update_option( Options::CODE_BLOCKS, $value );

		$this->assertSame( $is_on, $this->options->is_on( Options::CODE_BLOCKS ) );
	}

	/**
	 * A switch that was never saved is off.
	 */
	public function test_a_switch_that_was_never_saved_is_off(): void {
		delete_option( Options::SAVE_IMAGES );

		$this->assertFalse( $this->options->is_on( Options::SAVE_IMAGES ) );
	}

	/**
	 * The list of the options has every option the class names.
	 */
	public function test_lists_every_option(): void {
		$constants = ( new ReflectionClass( Options::class ) )->getConstants();

		unset( $constants['ALL'] );

		$this->assertSame( array_values( $constants ), Options::ALL );
		$this->assertCount( count( Options::ALL ), array_unique( Options::ALL ) );

		foreach ( Options::ALL as $option ) {
			$this->assertStringStartsWith( 'mermaid_blocks_', $option );
		}
	}

	/**
	 * Deleting the plugin deletes every option it has.
	 */
	public function test_uninstall_deletes_every_option(): void {
		foreach ( Options::ALL as $option ) {
			update_option( $option, 1 );
		}

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'mermaid-blocks/mermaid-blocks.php' );
		}

		require dirname( __DIR__ ) . '/uninstall.php';

		foreach ( Options::ALL as $option ) {
			$this->assertFalse( get_option( $option ), $option );
		}
	}
}
