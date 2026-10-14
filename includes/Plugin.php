<?php
/**
 * The plugin, which lists its parts and adds them to WordPress.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lists the parts of the plugin that add hooks to WordPress, and adds those
 * of each part on the requests that need it. A part, and what it is built
 * from, is created when it is first needed: see Container.
 *
 * The function mermaid_blocks() returns the one instance. Through it, other
 * code reaches each part: to output a diagram, or to remove one of the hooks.
 *
 *     echo mermaid_blocks()->diagram()->get_markup( $code );
 *     remove_filter( 'the_content', array( mermaid_blocks()->get( Integrations\CodeBlocks::class ), 'render_content' ) );
 *
 * A new part is a class that implements Hookable, and a line in one of the
 * lists below. A unit test tells when a class that adds hooks is in none.
 */
final class Plugin {

	/**
	 * The parts every request needs.
	 */
	const PARTS = array(
		Assets::class,
		Integrations\Block::class,
		Integrations\Shortcode::class,
		Integrations\CodeBlocks::class,
		Images\SavedImages::class,
	);

	/**
	 * The parts only the admin needs.
	 */
	const ADMIN_PARTS = array(
		Admin\SettingsPage::class,
		Admin\Editor::class,
	);

	/**
	 * The parts needed only once an action fires, with the actions: each one
	 * the part hooks into that can come first. The part is created then, so
	 * a request on which none of them fires never loads it.
	 *
	 * The hooks of such a part are added when the action fires, so they can't
	 * be removed before. To keep one from being added, remove
	 * `array( mermaid_blocks(), 'add_deferred_hooks' )` from the action, at
	 * priority 0.
	 */
	const DEFERRED_PARTS = array(
		// Also where the block editor is loaded outside the admin.
		Admin\Editor::class                     => array( 'enqueue_block_editor_assets' ),
		Abilities\ClientAbilities::class        => array( 'enqueue_block_editor_assets' ),
		Abilities\Registrar::class              => array( 'wp_abilities_api_categories_init', 'wp_abilities_api_init' ),
		Images\ImageSync::class                 => array( 'wp_after_insert_post' ),
		Images\ImagesController::class          => array( 'rest_api_init' ),
		// Only where Elementor is active.
		Integrations\Elementor\Registrar::class => array( 'elementor/widgets/register', 'elementor/frontend/after_register_scripts' ),
	);

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
	 * The container, which creates the parts.
	 *
	 * @var Container
	 */
	private Container $container;

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
	 * Sets up the plugin. Nothing but the container is created: adding the
	 * hooks is left to init().
	 *
	 * @param string $plugin_file The main file of the plugin.
	 */
	private function __construct( string $plugin_file ) {
		$this->container = new Container();

		// The one part that needs something else than other parts.
		$this->container->set( new Files( $plugin_file ) );
	}

	/**
	 * Adds the hooks of the parts to WordPress, once: now for the parts this
	 * request needs, and when its action fires for a part that waits for one.
	 */
	public function init(): void {
		if ( $this->initialized ) {
			return;
		}

		$this->initialized = true;

		foreach ( is_admin() ? array_merge( self::PARTS, self::ADMIN_PARTS ) : self::PARTS as $part ) {
			$this->get( $part )->hooks();
		}

		foreach ( array_unique( array_merge( ...array_values( self::DEFERRED_PARTS ) ) ) as $action ) {
			// Before the callbacks of the parts themselves, at the default priority.
			add_action( $action, array( $this, 'add_deferred_hooks' ), 0 );
		}
	}

	/**
	 * Adds the hooks of the parts that waited for the action that fires now.
	 *
	 * Each time the action fires: adding the same hooks again changes nothing,
	 * and puts back those something removed in between.
	 */
	public function add_deferred_hooks(): void {
		$action = current_action();

		foreach ( self::DEFERRED_PARTS as $part => $actions ) {
			if ( in_array( $action, $actions, true ) ) {
				$this->get( $part )->hooks();
			}
		}
	}

	/**
	 * Returns a part of the plugin, or anything a part is built from, created
	 * on first use.
	 *
	 * @template T of object
	 *
	 * @param string $name The name of a class of the plugin, such as
	 *                     `Images\SavedImages::class`.
	 *
	 * @phpstan-param class-string<T> $name
	 *
	 * @return object The object: the same one each time.
	 *
	 * @phpstan-return T
	 */
	public function get( string $name ): object {
		return $this->container->get( $name );
	}

	/**
	 * Returns the diagram markup, for any integration.
	 *
	 * @return Diagram The diagram markup.
	 */
	public function diagram(): Diagram {
		return $this->get( Diagram::class );
	}

	/**
	 * Returns the themes a diagram can be drawn in.
	 *
	 * @return Themes The themes.
	 */
	public function themes(): Themes {
		return $this->get( Themes::class );
	}
}
