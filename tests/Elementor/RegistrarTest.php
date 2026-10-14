<?php
/**
 * Tests of the widget's registration with Elementor.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests\Elementor;

use Elementor\Plugin as Elementor;
use MermaidBlocks\Integrations\Elementor\DiagramWidget;
use MermaidBlocks\Integrations\Elementor\Registrar;
use MermaidBlocks\Plugin;
use WP_UnitTestCase;

/**
 * How Elementor gets the widget and its script. Elementor is active.
 *
 * @covers \MermaidBlocks\Integrations\Elementor\Registrar
 */
class RegistrarTest extends WP_UnitTestCase {

	/**
	 * Removes the script, so each test registers it again.
	 */
	public function tear_down(): void {
		wp_deregister_script( Registrar::SCRIPT );

		parent::tear_down();
	}

	/**
	 * It waits for Elementor's actions, and adds itself to them.
	 */
	public function test_waits_for_elementor(): void {
		$registrar = mermaid_blocks()->get( Registrar::class );

		$this->assertSame(
			array( 'elementor/widgets/register', 'elementor/frontend/after_register_scripts' ),
			Plugin::DEFERRED_PARTS[ Registrar::class ]
		);

		$registrar->hooks();

		$this->assertSame( 10, has_action( 'elementor/widgets/register', array( $registrar, 'register_widget' ) ) );
		$this->assertSame( 10, has_action( 'elementor/frontend/after_register_scripts', array( $registrar, 'register_script' ) ) );
	}

	/**
	 * Elementor lists the widget once it registered its own.
	 */
	public function test_registers_the_widget(): void {
		$widget = Elementor::$instance->widgets_manager->get_widget_types( DiagramWidget::NAME );

		$this->assertInstanceOf( DiagramWidget::class, $widget );
	}

	/**
	 * The script is registered when Elementor registers its own, after them,
	 * in the footer.
	 */
	public function test_registers_the_script(): void {
		$this->assertFalse( wp_script_is( Registrar::SCRIPT, 'registered' ) );

		Elementor::$instance->frontend->register_scripts();

		$script = wp_scripts()->query( Registrar::SCRIPT );

		$this->assertNotFalse( $script );
		$this->assertStringEndsWith( '/build/elementor.js', $script->src );
		$this->assertContains( 'jquery', $script->deps );
		$this->assertSame( 1, $script->extra['group'] );
	}
}
