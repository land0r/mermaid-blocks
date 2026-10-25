<?php
/**
 * A class that needs another, which needs it: see ContainerTest.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests\Fixtures;

/**
 * Needs a chicken to be created.
 */
final class Egg {

	/**
	 * Sets up the egg.
	 *
	 * @param Chicken $chicken What laid it.
	 */
	public function __construct( Chicken $chicken ) {
		unset( $chicken );
	}
}
