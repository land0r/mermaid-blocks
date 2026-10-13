<?php
/**
 * The container, which creates the plugin's objects.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

use LogicException;
use ReflectionClass;
use ReflectionNamedType;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Creates the objects of the plugin's classes, one of each, when they are
 * first asked for.
 *
 * A class says what it needs in its constructor, as parameters with a class
 * for a type. The container creates those first, so nothing is wired by
 * hand, and a class nothing asks for is never loaded.
 *
 *     $diagram = $container->get( Diagram::class );
 *
 * An object that needs something else than objects, such as the plugin's
 * main file, is created by hand and given to set().
 */
final class Container {

	/**
	 * The objects created so far, by the name of their class.
	 *
	 * @var object[]
	 */
	private array $instances = array();

	/**
	 * The classes being created, to tell two classes that need each other.
	 *
	 * @var bool[]
	 */
	private array $creating = array();

	/**
	 * Sets up the container. It holds itself, for the few classes that
	 * create others by name: see Abilities\Registrar.
	 */
	public function __construct() {
		$this->set( $this );
	}

	/**
	 * Gives the container an object that was created by hand.
	 *
	 * @param object $instance The object. It replaces one of the same class.
	 */
	public function set( object $instance ): void {
		$this->instances[ get_class( $instance ) ] = $instance;
	}

	/**
	 * Tells whether the object of a class was created.
	 *
	 * @param string $name The name of the class.
	 *
	 * @return bool True when get() would return an object that exists.
	 */
	public function has( string $name ): bool {
		return isset( $this->instances[ $name ] );
	}

	/**
	 * Returns the object of a class, created on first use.
	 *
	 * @template T of object
	 *
	 * @param string $name The name of a class of the plugin.
	 *
	 * @phpstan-param class-string<T> $name
	 *
	 * @return object The object: the same one each time.
	 *
	 * @phpstan-return T
	 *
	 * @throws LogicException For a class the container can't create.
	 */
	public function get( string $name ): object {
		if ( ! isset( $this->instances[ $name ] ) ) {
			$this->instances[ $name ] = $this->create( $name );
		}

		return $this->instances[ $name ];
	}

	/**
	 * Creates the object of a class, with the objects its constructor asks
	 * for.
	 *
	 * @param string $name The name of the class.
	 *
	 * @return object The object.
	 *
	 * @throws LogicException For a class of another namespace, one that can't
	 *                        be created, one that needs itself, and a
	 *                        constructor parameter that isn't a class.
	 */
	private function create( string $name ): object {
		// Only the plugin's own classes: get() is reachable through mermaid_blocks().
		if ( 0 !== strpos( $name, __NAMESPACE__ . '\\' ) || ! class_exists( $name ) ) {
			throw new LogicException( esc_html( "$name is not a class of the plugin." ) );
		}

		if ( isset( $this->creating[ $name ] ) ) {
			throw new LogicException( esc_html( "$name needs itself, through the classes its constructor asks for." ) );
		}

		$class = new ReflectionClass( $name );

		if ( ! $class->isInstantiable() ) {
			throw new LogicException( esc_html( "$name cannot be created: it is abstract, or its constructor is not public." ) );
		}

		$constructor = $class->getConstructor();
		$arguments   = array();

		$this->creating[ $name ] = true;

		try {
			foreach ( $constructor ? $constructor->getParameters() : array() as $parameter ) {
				$type = $parameter->getType();

				if ( ! $type instanceof ReflectionNamedType || $type->isBuiltin() ) {
					throw new LogicException( esc_html( "$name cannot be created: \${$parameter->getName()} is not a class. Create the object by hand and give it to set()." ) );
				}

				$arguments[] = $this->get( $type->getName() );
			}
		} finally {
			unset( $this->creating[ $name ] );
		}

		return new $name( ...$arguments );
	}
}
