<?php
/**
 * Tests of the container.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use LogicException;
use GraphDraw\Abilities\Ability;
use GraphDraw\Assets;
use GraphDraw\Container;
use GraphDraw\Diagram;
use GraphDraw\Files;
use GraphDraw\Hookable;
use GraphDraw\Options;
use GraphDraw\Plugin;
use GraphDraw\Tests\Fixtures\Chicken;
use GraphDraw\Themes;
use ReflectionClass;
use WP_Query;
use WP_UnitTestCase;

require_once __DIR__ . '/PluginClasses.php';
require_once __DIR__ . '/fixtures/Chicken.php';
require_once __DIR__ . '/fixtures/Egg.php';

/**
 * How the objects of the plugin are created: on first use, one of each, with
 * what their constructors ask for.
 *
 * @covers \GraphDraw\Container
 */
class ContainerTest extends WP_UnitTestCase {

	use PluginClasses;

	/**
	 * A container that has the plugin's files, as the plugin's own has.
	 *
	 * @var Container
	 */
	private Container $container;

	/**
	 * Creates the container.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->container = new Container();
		$this->container->set( new Files( GRAPHDRAW_PLUGIN_FILE ) );
	}

	/**
	 * Returns the classes of the plugin that an object can be made of: not an
	 * abstract class, and not the plugin, which creates itself.
	 *
	 * @return string[] The names of the classes.
	 */
	private function get_classes(): array {
		return array_values(
			array_filter(
				$this->get_plugin_classes(),
				static function ( string $name ): bool {
					return ( new ReflectionClass( $name ) )->isInstantiable();
				}
			)
		);
	}

	/**
	 * An object is created when it is first asked for, and is the same one
	 * each time.
	 */
	public function test_creates_an_object_once(): void {
		$this->assertFalse( $this->container->has( Options::class ) );

		$options = $this->container->get( Options::class );

		$this->assertInstanceOf( Options::class, $options );
		$this->assertTrue( $this->container->has( Options::class ) );
		$this->assertSame( $options, $this->container->get( Options::class ) );
	}

	/**
	 * A class gets the objects its constructor asks for, created first, and
	 * shares them with the other classes that ask for them.
	 */
	public function test_creates_what_a_class_needs(): void {
		$this->assertFalse( $this->container->has( Themes::class ) );

		$diagram = $this->container->get( Diagram::class );

		$this->assertInstanceOf( Diagram::class, $diagram );
		$this->assertTrue( $this->container->has( Themes::class ) );
		$this->assertTrue( $this->container->has( Assets::class ) );
		$this->assertTrue( $this->container->has( Options::class ) );
		$this->assertSame( 'auto', $this->container->get( Themes::class )->resolve( 'no-such-theme' ) );
	}

	/**
	 * It holds itself, for the classes that create others by name.
	 */
	public function test_holds_itself(): void {
		$this->assertSame( $this->container, $this->container->get( Container::class ) );
	}

	/**
	 * An object made by hand takes the place of the one it would create.
	 */
	public function test_takes_an_object_made_by_hand(): void {
		$files = new Files( '/elsewhere/plugin.php' );

		$this->container->set( $files );

		$this->assertSame( $files, $this->container->get( Files::class ) );
	}

	/**
	 * Every class of the plugin can be created, with nothing wired by hand
	 * but the plugin's files: none asks for something that isn't a class, and
	 * no two need each other.
	 */
	public function test_creates_every_class_of_the_plugin(): void {
		$classes = $this->get_classes();

		$this->assertGreaterThan( 25, count( $classes ) );

		foreach ( $classes as $class ) {
			$this->assertInstanceOf( $class, $this->container->get( $class ), $class );
		}
	}

	/**
	 * Names it creates nothing for, with the reason.
	 *
	 * @return array[] The name, and what the error says.
	 */
	public function data_refused(): array {
		return array(
			'a class of WordPress'        => array( WP_Query::class, 'is not a class of the plugin' ),
			'a class that does not exist' => array( 'GraphDraw\\Nothing', 'is not a class of the plugin' ),
			'an interface'                => array( Hookable::class, 'is not a class of the plugin' ),
			'an abstract class'           => array( Ability::class, 'cannot be created' ),
			'a private constructor'       => array( Plugin::class, 'cannot be created' ),
			'two that need each other'    => array( Chicken::class, 'needs itself' ),
		);
	}

	/**
	 * It creates the plugin's own classes only, and says why it can't create
	 * one, instead of failing somewhere else.
	 *
	 * @dataProvider data_refused
	 *
	 * @param string $name    The name.
	 * @param string $message What the error says.
	 */
	public function test_refuses_what_it_cannot_create( string $name, string $message ): void {
		$this->expectException( LogicException::class );
		$this->expectExceptionMessage( $message );

		$this->container->get( $name );
	}

	/**
	 * A class whose constructor asks for something else than objects has to
	 * be created by hand: the error names the parameter.
	 */
	public function test_refuses_a_parameter_that_is_no_class(): void {
		$this->expectException( LogicException::class );
		$this->expectExceptionMessage( '$plugin_file is not a class' );

		( new Container() )->get( Files::class );
	}

	/**
	 * A class it failed to create can be created once what was missing is
	 * there: the failure leaves nothing behind.
	 */
	public function test_recovers_from_a_failure(): void {
		$container = new Container();

		try {
			$container->get( Assets::class );
			$this->fail( 'Assets needs the files, which were not given.' );
		} catch ( LogicException $exception ) {
			$this->assertFalse( $container->has( Assets::class ) );
		}

		$container->set( new Files( GRAPHDRAW_PLUGIN_FILE ) );

		$this->assertInstanceOf( Assets::class, $container->get( Assets::class ) );
	}
}
