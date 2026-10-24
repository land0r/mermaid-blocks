<?php
/**
 * Tests of the Elementor widget.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests\Elementor;

use Elementor\Controls_Manager;
use Elementor\Core\Frontend\Performance;
use Elementor\Plugin as Elementor;
use MermaidBlocks\Admin\SettingsPage;
use MermaidBlocks\Assets;
use MermaidBlocks\Diagram;
use MermaidBlocks\DiagramTypes;
use MermaidBlocks\Integrations\Elementor\DiagramWidget;
use MermaidBlocks\Integrations\Elementor\Registrar;
use MermaidBlocks\Integrations\Shortcode;
use ReflectionProperty;
use WP_UnitTestCase;

/**
 * The widget: its place in Elementor's panel, its controls, and what it
 * outputs. Elementor is active.
 *
 * @covers \MermaidBlocks\Integrations\Elementor\DiagramWidget
 */
class DiagramWidgetTest extends WP_UnitTestCase {

	/**
	 * Code whose labels have each character that needs escaping.
	 */
	const CODE = "flowchart LR\nA[\"Tom & Jerry's\"] --> B{x < y > z}\nB --> C[gallery]";

	/**
	 * Returns the widget as Elementor creates it for one on a page.
	 *
	 * @param array $settings The settings of the widget, as Elementor saved them.
	 *
	 * @return DiagramWidget The widget.
	 */
	private function create_widget( array $settings ): DiagramWidget {
		return new DiagramWidget(
			array(
				'id'         => 'a1b2c3d',
				'elType'     => 'widget',
				'widgetType' => DiagramWidget::NAME,
				'settings'   => $settings,
			),
			array()
		);
	}

	/**
	 * Returns what a widget outputs inside its wrapper.
	 *
	 * @param array $settings The settings of the widget.
	 *
	 * @return string The markup.
	 */
	private function render_widget( array $settings ): string {
		ob_start();
		$this->create_widget( $settings )->render_content();

		// Without the indentation of Elementor's template around it.
		return trim( (string) ob_get_clean() );
	}

	/**
	 * Returns the controls of the widget, as the editor gets them now.
	 *
	 * Elementor builds them once per request, so they are built again. On the
	 * front end it keeps only what rendering needs, and it decides once per
	 * request whether it is on the front end: as in the editor, it keeps all.
	 *
	 * @return array[] The controls, by name.
	 */
	private function get_controls(): array {
		$front_end = new ReflectionProperty( Performance::class, 'is_frontend' );

		if ( PHP_VERSION_ID < 80100 ) {
			$front_end->setAccessible( true );
		}

		$front_end->setValue( null, false );

		$widget = $this->create_widget( array() );

		Elementor::$instance->controls_manager->delete_stack( $widget );

		try {
			return $widget->get_controls();
		} finally {
			$front_end->setValue( null, null );
		}
	}

	/**
	 * The panel lists it with Elementor's general widgets.
	 */
	public function test_is_in_the_panel(): void {
		$widget = Elementor::$instance->widgets_manager->get_widget_types( DiagramWidget::NAME );

		$this->assertSame( 'Mermaid Diagram', $widget->get_title() );
		$this->assertSame( array( 'general' ), $widget->get_categories() );
		$this->assertArrayHasKey( 'general', Elementor::$instance->elements_manager->get_categories() );
		$this->assertContains( 'mermaid', $widget->get_keywords() );
		$this->assertTrue( $widget->show_in_panel() );
	}

	/**
	 * Elementor loads what draws the diagram where the widget is, also when it
	 * renders the widget over AJAX, where enqueueing has no effect.
	 */
	public function test_declares_what_draws_it(): void {
		$widget = $this->create_widget( array() );

		$this->assertSame( array( Assets::DIAGRAM, Registrar::SCRIPT ), $widget->get_script_depends() );
		$this->assertSame( array( Assets::DIAGRAM ), $widget->get_style_depends() );
		$this->assertTrue( wp_script_is( Assets::DIAGRAM, 'registered' ) );
		$this->assertTrue( wp_style_is( Assets::DIAGRAM, 'registered' ) );
	}

	/**
	 * The controls are the block's settings, under the names of its
	 * attributes, with the block's defaults: a flowchart to start from, the
	 * site's theme, and no controls for visitors.
	 */
	public function test_has_the_settings_of_the_block(): void {
		$controls = $this->get_controls();

		foreach ( array( 'code', 'caption', 'theme', 'align', 'accTitle', 'accDescr' ) as $name ) {
			$this->assertArrayHasKey( $name, $controls, $name );
		}

		$this->assertSame( Controls_Manager::CODE, $controls['code']['type'] );
		$this->assertSame( mermaid_blocks()->get( DiagramTypes::class )->get_all()['flowchart']['code'], $controls['code']['default'] );
		$this->assertSame( '', $controls['theme']['default'] );
		$this->assertSame( 'center', $controls['align']['return_value'] );

		foreach ( Diagram::CONTROLS as $control ) {
			$this->assertSame( Controls_Manager::SWITCHER, $controls[ $control ]['type'], $control );
			$this->assertSame( '', $controls[ $control ]['default'], $control );
		}
	}

	/**
	 * The themes are the block's: the site's first, then each one by name.
	 */
	public function test_offers_the_themes(): void {
		update_option( 'mermaid_blocks_theme', 'forest' );

		$options = $this->get_controls()['theme']['options'];
		$themes  = mermaid_blocks()->themes()->get_all();

		$this->assertSame( array_merge( array( '' ), array_keys( $themes ) ), array_keys( $options ) );
		$this->assertSame( 'Site default (Forest)', $options[''] );
	}

	/**
	 * The theme's help says what a theme is only when Pele is the renderer.
	 */
	public function test_the_theme_help_changes_only_with_pele(): void {
		update_option( 'mermaid_blocks_renderer', 'mermaid' );
		$this->assertStringNotContainsString( 'With Pele', $this->get_controls()['theme']['description'] );

		update_option( 'mermaid_blocks_renderer', 'pele' );
		$this->assertStringContainsString( 'With Pele, a theme counts as light or dark.', $this->get_controls()['theme']['description'] );
	}

	/**
	 * The theme's help links to the settings page, for those who may change
	 * it, and only in the editor: the front end builds the controls too.
	 */
	public function test_links_to_the_settings_in_the_editor(): void {
		$url = mermaid_blocks()->get( SettingsPage::class )->get_url();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->assertStringNotContainsString( $url, $this->get_controls()['theme']['description'] );

		set_current_screen( 'post' );
		$this->assertStringContainsString( esc_url( $url ), $this->get_controls()['theme']['description'] );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->assertStringNotContainsString( $url, $this->get_controls()['theme']['description'] );

		set_current_screen( 'front' );
	}

	/**
	 * A widget gives the markup the shortcode gives for the same settings,
	 * through the same code.
	 */
	public function test_outputs_what_the_shortcode_does(): void {
		$markup = $this->render_widget(
			array(
				'code'     => self::CODE,
				'theme'    => 'dark',
				'zoom'     => 'yes',
				'download' => 'yes',
				'caption'  => 'A <strong>caption</strong> & more',
				'accTitle' => 'Tom & "Jerry" [x]',
				'accDescr' => "It's <b>bold</b>",
				'align'    => 'center',
			)
		);

		$this->assertSame(
			mermaid_blocks()->get( Shortcode::class )->render(
				array(
					'theme'       => 'dark',
					'zoom'        => 'true',
					'download'    => 'true',
					'caption'     => 'A <strong>caption</strong> & more',
					'title'       => 'Tom & "Jerry" [x]',
					'description' => "It's <b>bold</b>",
					'align'       => 'center',
				),
				esc_html( self::CODE ),
				Shortcode::PREFIXED_TAG
			),
			$markup
		);

		// Escaped, with the brackets as entities so no shortcode runs inside.
		$this->assertStringContainsString( 'A&#91;&quot;Tom &amp; Jerry&#039;s&quot;&#93; --&gt; B{x &lt; y &gt; z}', $markup );
		$this->assertStringContainsString( 'data-mermaid-title="Tom &amp; &quot;Jerry&quot; &#91;x&#93;"', $markup );
		$this->assertStringContainsString( 'data-mermaid-description="It&#039;s &lt;b&gt;bold&lt;/b&gt;"', $markup );
	}

	/**
	 * The controls the shortcode lacks are the block's too.
	 */
	public function test_outputs_every_control(): void {
		$markup = $this->render_widget(
			array(
				'code'       => 'A --> B',
				'zoom'       => 'yes',
				'download'   => '',
				'copy'       => 'yes',
				'fullscreen' => 'yes',
			)
		);

		$this->assertStringContainsString( 'data-mermaid-controls="zoom copy fullscreen"', $markup );
		$this->assertStringContainsString( 'data-mermaid-theme="auto"', $markup );
		$this->assertStringNotContainsString( 'align', $markup );
	}

	/**
	 * Without code a widget shows nothing, as the block doesn't.
	 */
	public function test_outputs_nothing_without_code(): void {
		$this->assertSame( '', $this->render_widget( array( 'code' => "  \n" ) ) );
	}

	/**
	 * Its diagram has no wrapper of Elementor's between it and the widget.
	 */
	public function test_has_no_inner_wrapper(): void {
		$markup = $this->render_widget( array( 'code' => 'A --> B' ) );

		$this->assertStringStartsWith( '<div class="mermaid-blocks-diagram"', $markup );
	}
}
