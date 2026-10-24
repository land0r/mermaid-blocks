<?php
/**
 * The Mermaid Diagram widget of Elementor.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Integrations\Elementor;

use Elementor\Controls_Manager;
use Elementor\Widget_Base;
use MermaidBlocks\Admin\SettingsPage;
use MermaidBlocks\Assets;
use MermaidBlocks\DiagramTypes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The Mermaid Diagram widget: a code field and the block's settings, under
 * the names of the block's attributes, so Diagram::render() outputs it as it
 * outputs the shortcode.
 *
 * Elementor creates it, with arrays for its constructor, so it is no part of
 * the plugin: it reaches the plugin through mermaid_blocks(). Only Elementor
 * can load it, because it extends a class of Elementor. In the editor,
 * Elementor renders it again over AJAX after each change, and the script of
 * Registrar draws the new diagram.
 */
final class DiagramWidget extends Widget_Base {

	/**
	 * The name of the widget.
	 */
	const NAME = 'mermaid-blocks-diagram';

	/**
	 * Where Mermaid's syntax is explained.
	 */
	const SYNTAX_URL = 'https://mermaid.js.org/intro/syntax-reference.html';

	/**
	 * Returns the name of the widget.
	 *
	 * @return string The name.
	 */
	public function get_name(): string {
		return self::NAME;
	}

	/**
	 * Returns the title of the widget, as the panel shows it.
	 *
	 * @return string The title.
	 */
	public function get_title(): string {
		return __( 'Mermaid Diagram', 'mermaid-blocks' );
	}

	/**
	 * Returns the icon of the widget, one of Elementor's.
	 *
	 * @return string The class of the icon.
	 */
	public function get_icon(): string {
		return 'eicon-flow';
	}

	/**
	 * Returns the categories of the panel the widget is in.
	 *
	 * @return string[] The categories.
	 */
	public function get_categories(): array {
		return array( 'general' );
	}

	/**
	 * Returns the words the widget is found by in the panel.
	 *
	 * @return string[] The words.
	 */
	public function get_keywords(): array {
		return array( 'mermaid', 'diagram', 'flowchart', 'chart' );
	}

	/**
	 * Returns where the panel's help link goes.
	 *
	 * @return string The URL.
	 */
	public function get_custom_help_url(): string {
		return self::SYNTAX_URL;
	}

	/**
	 * Returns the scripts the widget needs: those that draw diagrams, and the
	 * one that draws a widget Elementor shows after the page loaded. Elementor
	 * loads them where the widget is, also when it renders over AJAX.
	 *
	 * @return string[] The handles.
	 */
	public function get_script_depends(): array {
		return array( Assets::DIAGRAM, Registrar::SCRIPT );
	}

	/**
	 * Returns the style the widget needs.
	 *
	 * @return string[] The handles.
	 */
	public function get_style_depends(): array {
		return array( Assets::DIAGRAM );
	}

	/**
	 * Tells Elementor to output the diagram without a wrapper of its own
	 * inside the widget's.
	 *
	 * @return bool False.
	 */
	public function has_widget_inner_wrapper(): bool {
		return false;
	}

	/**
	 * Adds the controls: the block's settings, in the same groups as in the
	 * block's sidebar.
	 */
	protected function register_controls(): void {
		$this->register_diagram_controls();
		$this->register_settings_controls();
		$this->register_visitor_controls();
		$this->register_accessibility_controls();
	}

	/**
	 * Adds the code and the caption.
	 */
	private function register_diagram_controls(): void {
		$types = mermaid_blocks()->get( DiagramTypes::class )->get_all();

		$this->start_controls_section(
			'section_diagram',
			array( 'label' => __( 'Diagram', 'mermaid-blocks' ) )
		);

		$this->add_control(
			'code',
			array(
				'label'       => __( 'Code', 'mermaid-blocks' ),
				'type'        => Controls_Manager::CODE,
				'language'    => 'text',
				'rows'        => 12,
				'default'     => $types['flowchart']['code'],
				'description' => sprintf(
					'<a href="%s" target="_blank" rel="noopener">%s</a>',
					esc_url( self::SYNTAX_URL ),
					esc_html__( 'Mermaid syntax', 'mermaid-blocks' )
				),
				// Elementor's AI writes HTML and CSS, not Mermaid.
				'ai'          => array( 'active' => false ),
			)
		);

		$this->add_control(
			'caption',
			array(
				'label'       => __( 'Caption', 'mermaid-blocks' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'ai'          => array( 'active' => false ),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Adds the theme, with the themes offered with the site's renderer, and
	 * the alignment. A widget's theme that isn't offered is shown as the one
	 * it is drawn as by the script of Registrar::EDITOR_SCRIPT.
	 */
	private function register_settings_controls(): void {
		$themes = mermaid_blocks()->themes();
		$labels = $themes->get_offered();
		$help   = esc_html__( 'Automatic turns dark on dark backgrounds. A theme set in the code overrides this.', 'mermaid-blocks' );

		// Only the editor shows it: the front end loads the controls too, and needs nothing of the admin.
		if ( is_admin() && current_user_can( 'manage_options' ) ) {
			$help .= sprintf(
				' <a href="%s" target="_blank" rel="noopener">%s</a>',
				esc_url( mermaid_blocks()->get( SettingsPage::class )->get_url() ),
				esc_html__( 'Change the site default', 'mermaid-blocks' )
			);
		}

		$this->start_controls_section(
			'section_settings',
			array( 'label' => __( 'Settings', 'mermaid-blocks' ) )
		);

		$this->add_control(
			'theme',
			array(
				'label'       => __( 'Theme', 'mermaid-blocks' ),
				'type'        => Controls_Manager::SELECT,
				// Under its label, wide enough for "Site default (Automatic)".
				'label_block' => true,
				'options'     => array(
					'' => sprintf(
						/* translators: %s: name of the theme set for the whole site, such as "Automatic" or "Forest". */
						__( 'Site default (%s)', 'mermaid-blocks' ),
						$labels[ $themes->get_shown( $themes->get_site_theme() ) ]
					),
				) + $labels,
				'default'     => '',
				'description' => $help,
			)
		);

		$this->add_control(
			'align',
			array(
				'label'        => __( 'Center', 'mermaid-blocks' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'center',
				'default'      => '',
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Adds a switch for each control visitors can get.
	 */
	private function register_visitor_controls(): void {
		$this->start_controls_section(
			'section_visitor_controls',
			array( 'label' => __( 'Visitor controls', 'mermaid-blocks' ) )
		);

		$this->add_control(
			'visitor_controls_help',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => esc_html__( 'Buttons on the published diagram.', 'mermaid-blocks' ),
				'content_classes' => 'elementor-descriptor',
			)
		);

		foreach ( $this->get_visitor_control_labels() as $control => $label ) {
			$this->add_control(
				$control,
				array(
					'label'   => $label,
					'type'    => Controls_Manager::SWITCHER,
					'default' => '',
				)
			);
		}

		$this->end_controls_section();
	}

	/**
	 * Returns the labels of the switches of the controls visitors can get.
	 *
	 * @return array The labels, by the name of each of Diagram::CONTROLS.
	 */
	private function get_visitor_control_labels(): array {
		return array(
			'zoom'       => __( 'Zoom controls', 'mermaid-blocks' ),
			'download'   => __( 'Download buttons', 'mermaid-blocks' ),
			'copy'       => __( 'Copy code button', 'mermaid-blocks' ),
			'fullscreen' => __( 'Fullscreen button', 'mermaid-blocks' ),
		);
	}

	/**
	 * Adds the title and the description for assistive technology.
	 */
	private function register_accessibility_controls(): void {
		$this->start_controls_section(
			'section_accessibility',
			array( 'label' => __( 'Accessibility', 'mermaid-blocks' ) )
		);

		$this->add_control(
			'accTitle',
			array(
				'label'       => __( 'Title', 'mermaid-blocks' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => __( 'A short name, read by screen readers.', 'mermaid-blocks' ),
				'ai'          => array( 'active' => false ),
			)
		);

		$this->add_control(
			'accDescr',
			array(
				'label'       => __( 'Description', 'mermaid-blocks' ),
				'type'        => Controls_Manager::TEXTAREA,
				'description' => __( 'What the diagram shows, read by screen readers.', 'mermaid-blocks' ),
				'ai'          => array( 'active' => false ),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Outputs the diagram, as the shortcode would with the same settings.
	 */
	protected function render(): void {
		// Escaped by Diagram: the source and the attributes, and the caption with wp_kses_post().
		echo mermaid_blocks()->diagram()->render( $this->get_settings_for_display() ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
