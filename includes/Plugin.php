<?php
/**
 * The plugin, which creates its parts and adds them to WordPress.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

use MermaidBlocks\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Creates the parts of the plugin, and adds their hooks to WordPress.
 *
 * The function mermaid_blocks() returns the one instance. Through it, other
 * code reaches each part: to output a diagram, or to remove one of the hooks.
 *
 *     echo mermaid_blocks()->diagram()->get_markup( $code );
 *     remove_action( 'admin_menu', array( mermaid_blocks()->settings(), 'add_page' ) );
 */
final class Plugin {

	/**
	 * The one instance.
	 *
	 * @var Plugin|null
	 */
	private static ?Plugin $instance = null;

	/**
	 * Whether the hooks were added.
	 *
	 * @var bool
	 */
	private bool $initialized = false;

	/**
	 * The themes a diagram can be drawn in.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * The settings page.
	 *
	 * @var Settings
	 */
	private Settings $settings;

	/**
	 * The scripts and styles of diagrams.
	 *
	 * @var Assets
	 */
	private Assets $assets;

	/**
	 * The diagram markup.
	 *
	 * @var Diagram
	 */
	private Diagram $diagram;

	/**
	 * The block.
	 *
	 * @var Block
	 */
	private Block $block;

	/**
	 * The diagram types with starter code.
	 *
	 * @var DiagramTypes
	 */
	private DiagramTypes $diagram_types;

	/**
	 * The diagrams in posts.
	 *
	 * @var PostDiagrams
	 */
	private PostDiagrams $post_diagrams;

	/**
	 * The abilities, with what registers them.
	 *
	 * @var Abilities\AbilitiesRegistrar
	 */
	private Abilities\AbilitiesRegistrar $abilities;

	/**
	 * Returns the one instance.
	 *
	 * @return Plugin The plugin.
	 */
	public static function instance(): Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self( MERMAID_BLOCKS_PLUGIN_FILE );
		}

		return self::$instance;
	}

	/**
	 * Creates the parts of the plugin. Adding their hooks is left to init().
	 *
	 * @param string $plugin_file The main file of the plugin.
	 */
	private function __construct( string $plugin_file ) {
		$this->themes        = new Themes();
		$this->settings      = new Settings( $this->themes, $plugin_file );
		$this->assets        = new Assets( $plugin_file );
		$this->diagram       = new Diagram( $this->themes, $this->settings, $this->assets );
		$this->diagram_types = new DiagramTypes();
		$this->block         = new Block( $this->assets, $this->diagram, $this->themes, $this->settings, $this->diagram_types );
		$this->post_diagrams = new PostDiagrams( $this->diagram_types );
		$this->abilities     = new Abilities\AbilitiesRegistrar(
			$this->assets,
			new Abilities\ListDiagramTypes( $this->diagram_types ),
			new Abilities\ListDiagrams( $this->post_diagrams, $this->themes ),
			new Abilities\GetDiagram( $this->post_diagrams, $this->themes ),
			new Abilities\BuildBlockMarkup( $this->post_diagrams, $this->themes ),
			new Abilities\InsertDiagram( $this->post_diagrams, $this->themes ),
			new Abilities\UpdateDiagram( $this->post_diagrams, $this->themes ),
			new Abilities\DeleteDiagram( $this->post_diagrams, $this->themes )
		);
	}

	/**
	 * Adds the hooks of every part to WordPress, once.
	 */
	public function init(): void {
		if ( $this->initialized ) {
			return;
		}

		$this->initialized = true;

		$this->assets->hooks();
		$this->block->hooks();
		$this->settings->hooks();
		$this->abilities->hooks();
	}

	/**
	 * Returns the themes a diagram can be drawn in.
	 *
	 * @return Themes The themes.
	 */
	public function themes(): Themes {
		return $this->themes;
	}

	/**
	 * Returns the settings page.
	 *
	 * @return Settings The settings.
	 */
	public function settings(): Settings {
		return $this->settings;
	}

	/**
	 * Returns the scripts and styles of diagrams.
	 *
	 * @return Assets The assets.
	 */
	public function assets(): Assets {
		return $this->assets;
	}

	/**
	 * Returns the diagram markup, for any integration.
	 *
	 * @return Diagram The diagram markup.
	 */
	public function diagram(): Diagram {
		return $this->diagram;
	}

	/**
	 * Returns the block.
	 *
	 * @return Block The block.
	 */
	public function block(): Block {
		return $this->block;
	}

	/**
	 * Returns the diagram types with starter code.
	 *
	 * @return DiagramTypes The diagram types.
	 */
	public function diagram_types(): DiagramTypes {
		return $this->diagram_types;
	}

	/**
	 * Returns the diagrams in posts.
	 *
	 * @return PostDiagrams The diagrams in posts.
	 */
	public function post_diagrams(): PostDiagrams {
		return $this->post_diagrams;
	}

	/**
	 * Returns the registrar of the abilities, which lists them.
	 *
	 * @return Abilities\AbilitiesRegistrar The registrar.
	 */
	public function abilities(): Abilities\AbilitiesRegistrar {
		return $this->abilities;
	}
}
