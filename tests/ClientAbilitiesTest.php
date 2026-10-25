<?php
/**
 * Tests of the abilities that run in the browser.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use GraphDraw\Abilities\ClientAbilities;
use GraphDraw\Abilities\Registrar;
use GraphDraw\Files;
use WP_UnitTestCase;

/**
 * The script module of the abilities, and the texts it is given.
 *
 * @covers \GraphDraw\Abilities\ClientAbilities
 */
class ClientAbilitiesTest extends WP_UnitTestCase {

	/**
	 * The abilities.
	 *
	 * @var ClientAbilities
	 */
	private ClientAbilities $abilities;

	/**
	 * Gets the abilities.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->abilities = graphdraw()->get( ClientAbilities::class );
	}

	/**
	 * The module can't translate, so it is given its texts: the category of
	 * the abilities, as the server registers it, and those of each ability.
	 */
	public function test_gives_the_module_its_texts(): void {
		$this->abilities->hooks();

		$data = apply_filters( 'script_module_data_' . ClientAbilities::MODULE, array( 'kept' => true ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.DynamicHooknameFound -- A hook of WordPress.

		$this->assertTrue( $data['kept'] );
		$this->assertSame(
			array( 'slug' => Registrar::CATEGORY ) + graphdraw()->get( Registrar::class )->get_category_args(),
			$data['category']
		);
		$this->assertSame( 'graphdraw', $data['category']['slug'] );
		$this->assertNotEmpty( $data['category']['label'] );
		$this->assertNotEmpty( $data['abilities']['validateDiagram']['label'] );
		$this->assertNotEmpty( $data['abilities']['validateDiagram']['description'] );
	}

	/**
	 * The module is built, as a module, and is loaded where WordPress has the
	 * client-side Abilities API, and only there.
	 */
	public function test_loads_the_module_where_wordpress_has_the_api(): void {
		$files = graphdraw()->get( Files::class );

		$this->assertFileExists( $files->get_build_path( 'abilities.js' ) );
		$this->assertNotEmpty( $files->get_build_asset( 'abilities' )['version'] );

		$modules = wp_script_modules();

		if ( ! method_exists( $modules, 'get_registered' ) ) {
			$this->abilities->enqueue();
			$this->markTestSkipped( 'This WordPress has no client-side Abilities API.' );
		}

		$had_api = (bool) $modules->get_registered( '@wordpress/core-abilities' );

		$modules->deregister( '@wordpress/core-abilities' );
		$modules->dequeue( ClientAbilities::MODULE );
		$this->abilities->enqueue();
		$this->assertNotContains( ClientAbilities::MODULE, $modules->get_queue() );

		$modules->register( '@wordpress/core-abilities', 'https://example.org/core-abilities.js' );
		$this->abilities->enqueue();
		$this->assertContains( ClientAbilities::MODULE, $modules->get_queue() );

		$modules->dequeue( ClientAbilities::MODULE );

		if ( ! $had_api ) {
			$modules->deregister( '@wordpress/core-abilities' );
		}
	}
}
