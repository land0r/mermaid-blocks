<?php
/**
 * A class that needs another, which needs it: see ContainerTest.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests\Fixtures;

/**
 * Needs an egg to be created.
 */
final class Chicken {

	/**
	 * Sets up the chicken.
	 *
	 * @param Egg $egg What it came from.
	 */
	public function __construct( Egg $egg ) {
		unset( $egg );
	}
}
