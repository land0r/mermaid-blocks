<?php
/**
 * Tests of the plugin.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Abilities\ClientAbilities;
use MermaidBlocks\Abilities\ListDiagrams;
use MermaidBlocks\Abilities\Registrar;
use MermaidBlocks\Abilities\Schemas;
use MermaidBlocks\Admin\Editor;
use MermaidBlocks\Admin\SettingsPage;
use MermaidBlocks\Assets;
use MermaidBlocks\Container;
use MermaidBlocks\Diagram;
use MermaidBlocks\DiagramTypes;
use MermaidBlocks\Files;
use MermaidBlocks\Hookable;
use MermaidBlocks\Images\ImagesController;
use MermaidBlocks\Images\ImageSync;
use MermaidBlocks\Images\SavedImages;
use MermaidBlocks\Integrations\Block;
use MermaidBlocks\Integrations\CodeBlocks;
use MermaidBlocks\Integrations\Shortcode;
use MermaidBlocks\Options;
use MermaidBlocks\Plugin;
use MermaidBlocks\Posts\EditablePosts;
use MermaidBlocks\Posts\PostDiagrams;
use MermaidBlocks\Themes;
use ReflectionClass;
use WP_Hook;
use WP_UnitTestCase;

require_once __DIR__ . '/PluginClasses.php';

/**
 * Which parts of the plugin a request gets, and when.
 *
 * @covers \MermaidBlocks\Plugin
 */
class PluginTest extends WP_UnitTestCase {

	use PluginClasses;

	/**
	 * Returns a plugin of its own, as a request starts with: nothing created,
	 * no hooks added.
	 *
	 * @return Plugin The plugin.
	 */
	private function create_plugin(): Plugin {
		$class       = new ReflectionClass( Plugin::class );
		$plugin      = $class->newInstanceWithoutConstructor();
		$constructor = $class->getConstructor();

		if ( PHP_VERSION_ID < 80100 ) {
			$constructor->setAccessible( true );
		}

		$constructor->invoke( $plugin, MERMAID_BLOCKS_PLUGIN_FILE );

		return $plugin;
	}

	/**
	 * Returns the container of a plugin, to tell what it created.
	 *
	 * @param Plugin $plugin The plugin.
	 *
	 * @return Container The container.
	 */
	private function get_container( Plugin $plugin ): Container {
		$property = ( new ReflectionClass( Plugin::class ) )->getProperty( 'container' );

		if ( PHP_VERSION_ID < 80100 ) {
			$property->setAccessible( true );
		}

		return $property->getValue( $plugin );
	}

	/**
	 * Returns every part the plugin lists.
	 *
	 * @return string[] The names of the classes.
	 */
	private function get_listed_parts(): array {
		return array_merge( Plugin::PARTS, Plugin::ADMIN_PARTS, array_keys( Plugin::DEFERRED_PARTS ) );
	}

	/**
	 * Returns how many callbacks WordPress has, on all hooks together.
	 *
	 * @return int The number.
	 */
	private function count_callbacks(): int {
		global $wp_filter;

		$count = 0;

		foreach ( $wp_filter as $hook ) {
			foreach ( $hook->callbacks as $callbacks ) {
				$count += count( $callbacks );
			}
		}

		return $count;
	}

	/**
	 * The function returns the one plugin, which gives the same parts each
	 * time, and the two that integrations call by name.
	 */
	public function test_gives_access_to_its_parts(): void {
		$plugin = mermaid_blocks();

		$this->assertSame( Plugin::instance(), $plugin );
		$this->assertInstanceOf( SavedImages::class, $plugin->get( SavedImages::class ) );
		$this->assertSame( $plugin->get( SavedImages::class ), $plugin->get( SavedImages::class ) );
		$this->assertSame( $plugin->get( Diagram::class ), $plugin->diagram() );
		$this->assertSame( $plugin->get( Themes::class ), $plugin->themes() );
	}

	/**
	 * Every class that adds hooks is in one of the lists: one that is in none
	 * would never add them. And every part in a list can add hooks.
	 */
	public function test_lists_every_class_that_adds_hooks(): void {
		$listed   = $this->get_listed_parts();
		$hookable = array_values(
			array_filter(
				$this->get_plugin_classes(),
				static function ( string $name ): bool {
					return is_subclass_of( $name, Hookable::class );
				}
			)
		);

		$this->assertNotEmpty( $hookable );
		$this->assertSame( array(), array_values( array_diff( $hookable, $listed ) ), 'A class that adds hooks is in none of the lists of Plugin.' );
		$this->assertSame( array(), array_values( array_diff( $listed, $hookable ) ), 'A part in the lists of Plugin has no hooks().' );

		// A part every request gets has no reason to wait for an action.
		$this->assertSame( array(), array_intersect( Plugin::PARTS, array_keys( Plugin::DEFERRED_PARTS ) ) );
	}

	/**
	 * A request outside the admin adds the hooks of the parts every request
	 * needs, and creates nothing else: not the settings page, the abilities,
	 * the routes, or what reads the diagrams of posts.
	 */
	public function test_creates_only_what_a_request_needs(): void {
		$plugin = $this->create_plugin();

		$this->assertFalse( $this->get_container( $plugin )->has( Assets::class ) );

		$plugin->init();

		$container = $this->get_container( $plugin );
		$created   = array( Files::class, Assets::class, Block::class, Shortcode::class, CodeBlocks::class, SavedImages::class, Diagram::class, DiagramTypes::class, Themes::class, Options::class );
		$waiting   = array( SettingsPage::class, Editor::class, ImageSync::class, ImagesController::class, Registrar::class, ClientAbilities::class, PostDiagrams::class, EditablePosts::class, Schemas::class, ListDiagrams::class );

		foreach ( $created as $class ) {
			$this->assertTrue( $container->has( $class ), $class );
		}

		foreach ( $waiting as $class ) {
			$this->assertFalse( $container->has( $class ), $class );
		}

		$this->assertSame( 9, has_action( 'init', array( $plugin->get( Assets::class ), 'register' ) ) );
		$this->assertSame( 10, has_action( 'init', array( $plugin->get( Block::class ), 'register' ) ) );
		$this->assertSame( 20, has_action( 'init', array( $plugin->get( Shortcode::class ), 'register' ) ) );
		$this->assertSame( 10, has_filter( 'the_content', array( $plugin->get( CodeBlocks::class ), 'render_content' ) ) );
		$this->assertSame( 10, has_action( 'before_delete_post', array( $plugin->get( SavedImages::class ), 'delete_all' ) ) );
		$this->assertFalse( has_action( 'admin_menu', array( $plugin->get( SettingsPage::class ), 'add_page' ) ) );
		$this->assertFalse( has_action( 'enqueue_block_assets', array( $plugin->get( Editor::class ), 'enqueue_canvas_assets' ) ) );
	}

	/**
	 * A request in the admin also gets the settings page and what the block
	 * editor needs.
	 */
	public function test_adds_the_admin_parts_in_the_admin(): void {
		set_current_screen( 'dashboard' );

		$plugin = $this->create_plugin();
		$plugin->init();

		$container = $this->get_container( $plugin );

		$this->assertTrue( $container->has( SettingsPage::class ) );
		$this->assertTrue( $container->has( Editor::class ) );
		$this->assertFalse( $container->has( Registrar::class ) );
		$this->assertFalse( $container->has( PostDiagrams::class ) );
		$this->assertSame( 10, has_action( 'admin_menu', array( $plugin->get( SettingsPage::class ), 'add_page' ) ) );
		$this->assertSame( 10, has_action( 'admin_init', array( $plugin->get( SettingsPage::class ), 'register' ) ) );
		$this->assertSame( 10, has_action( 'enqueue_block_assets', array( $plugin->get( Editor::class ), 'enqueue_canvas_assets' ) ) );
		$this->assertSame( 10, has_action( 'enqueue_block_editor_assets', array( $plugin->get( Editor::class ), 'add_editor_settings' ) ) );
	}

	/**
	 * The hooks are added once, however often the plugin is started.
	 */
	public function test_adds_its_hooks_once(): void {
		$plugin = $this->create_plugin();
		$plugin->init();

		$count = $this->count_callbacks();

		$plugin->init();

		$this->assertSame( $count, $this->count_callbacks() );
	}

	/**
	 * The plugin waits on each action a part waits for, before the callbacks
	 * of the part itself.
	 */
	public function test_waits_for_the_actions_of_the_parts_that_wait(): void {
		$plugin = $this->create_plugin();
		$plugin->init();

		foreach ( Plugin::DEFERRED_PARTS as $part => $actions ) {
			$this->assertNotEmpty( $actions, $part );

			foreach ( $actions as $action ) {
				$this->assertSame( 0, has_action( $action, array( $plugin, 'add_deferred_hooks' ) ), $action );
			}
		}
	}

	/**
	 * The parts that wait for an action, with each action.
	 *
	 * @return array[] The part and the action.
	 */
	public function data_deferred(): array {
		$cases = array();

		foreach ( Plugin::DEFERRED_PARTS as $part => $actions ) {
			foreach ( $actions as $action ) {
				$cases[ substr( strrchr( $part, '\\' ), 1 ) . ' on ' . $action ] = array( $part, $action );
			}
		}

		return $cases;
	}

	/**
	 * A part that waits for an action is created when it fires, and listens
	 * to it from then on: in time for that same firing.
	 *
	 * @dataProvider data_deferred
	 *
	 * @param string $part   The class of the part.
	 * @param string $action The action it waits for.
	 */
	public function test_adds_the_hooks_of_a_part_when_its_action_fires( string $part, string $action ): void {
		global $wp_filter;

		$plugin = $this->create_plugin();
		$plugin->init();

		$this->assertFalse( $this->get_container( $plugin )->has( $part ) );

		// Nothing but the plugin listens, so the test runs no callback of WordPress or of another test.
		$wp_filter[ $action ] = new WP_Hook(); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restored after the test, with every other hook.
		add_action( $action, array( $plugin, 'add_deferred_hooks' ), 0 );

		$listens = false;

		add_action(
			$action,
			function () use ( &$listens, $plugin, $part, $action ) {
				global $wp_filter;

				foreach ( $wp_filter[ $action ]->callbacks as $priority => $callbacks ) {
					foreach ( $callbacks as $callback ) {
						if ( is_array( $callback['function'] ) && $plugin->get( $part ) === $callback['function'][0] ) {
							$listens = $priority;
						}
					}

					// What the part does when the action fires is tested with the part.
					if ( $priority > 1 ) {
						remove_all_actions( $action, $priority );
					}
				}
			},
			1
		);

		do_action( $action ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.DynamicHooknameFound -- Actions of WordPress.

		$this->assertTrue( $this->get_container( $plugin )->has( $part ) );
		$this->assertSame( 10, $listens );
	}

	/**
	 * A part may be asked for its hooks more than once, as the parts that wait
	 * for an action are, each time it fires: nothing is added twice.
	 */
	public function test_parts_add_their_hooks_once(): void {
		foreach ( $this->get_listed_parts() as $part ) {
			$instance = mermaid_blocks()->get( $part );

			$instance->hooks();

			$count = $this->count_callbacks();

			$instance->hooks();

			$this->assertSame( $count, $this->count_callbacks(), $part );
		}
	}
}
