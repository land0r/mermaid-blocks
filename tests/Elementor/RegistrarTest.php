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
use MermaidBlocks\Options;
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
		wp_deregister_script( Registrar::EDITOR_SCRIPT );

		parent::tear_down();
	}

	/**
	 * It waits for Elementor's actions, and adds itself to them.
	 */
	public function test_waits_for_elementor(): void {
		$registrar = mermaid_blocks()->get( Registrar::class );

		$this->assertSame(
			array( 'elementor/widgets/register', 'elementor/frontend/after_register_scripts', 'elementor/editor/after_enqueue_scripts' ),
			Plugin::DEFERRED_PARTS[ Registrar::class ]
		);

		$registrar->hooks();

		$this->assertSame( 10, has_action( 'elementor/widgets/register', array( $registrar, 'register_widget' ) ) );
		$this->assertSame( 10, has_action( 'elementor/frontend/after_register_scripts', array( $registrar, 'register_script' ) ) );
		$this->assertSame( 10, has_action( 'elementor/editor/after_enqueue_scripts', array( $registrar, 'enqueue_editor_script' ) ) );
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

	/**
	 * With Pele, Elementor's editor gets the script that shows a theme that
	 * isn't offered as the one it is drawn as, after Elementor's own, with
	 * those themes.
	 */
	public function test_enqueues_the_editor_script_with_pele(): void {
		update_option( Options::RENDERER, 'pele' );

		mermaid_blocks()->get( Registrar::class )->enqueue_editor_script();

		$script = wp_scripts()->query( Registrar::EDITOR_SCRIPT );

		$this->assertTrue( wp_script_is( Registrar::EDITOR_SCRIPT, 'enqueued' ) );
		$this->assertStringEndsWith( '/build/elementor-editor.js', $script->src );
		$this->assertContains( 'elementor-editor', $script->deps );
		$before = (array) wp_scripts()->get_data( Registrar::EDITOR_SCRIPT, 'before' );

		$this->assertSame(
			'var mermaidBlocksThemeAliases = ' . wp_json_encode( mermaid_blocks()->themes()->get_aliases() ) . ';',
			end( $before )
		);
	}

	/**
	 * With Mermaid.js, which offers every theme, it has nothing to do.
	 */
	public function test_leaves_the_editor_script_out_with_mermaid(): void {
		update_option( Options::RENDERER, 'mermaid' );

		mermaid_blocks()->get( Registrar::class )->enqueue_editor_script();

		$this->assertFalse( wp_script_is( Registrar::EDITOR_SCRIPT, 'registered' ) );
	}
}
