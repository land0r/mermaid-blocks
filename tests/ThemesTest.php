<?php
/**
 * Tests of the themes.
 *
 * @package GraphDraw
 */

namespace GraphDraw\Tests;

use GraphDraw\Options;
use GraphDraw\Themes;
use WP_UnitTestCase;

/**
 * The themes a diagram can be drawn in, and the one a diagram gets.
 *
 * @covers \GraphDraw\Themes
 */
class ThemesTest extends WP_UnitTestCase {

	/**
	 * The themes.
	 *
	 * @var Themes
	 */
	private Themes $themes;

	/**
	 * Gets the themes.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->themes = graphdraw()->themes();
	}

	/**
	 * Mermaid.js offers every theme, with none shown as another.
	 */
	public function test_offers_every_theme_with_mermaid(): void {
		update_option( Options::RENDERER, 'mermaid' );

		$this->assertSame( $this->themes->get_all(), $this->themes->get_offered() );
		$this->assertSame( array(), $this->themes->get_aliases() );
		$this->assertSame( 'forest', $this->themes->get_shown( 'forest' ) );
	}

	/**
	 * Pele, which draws a theme as light or dark, offers the automatic theme,
	 * Light and Dark: Mermaid.js's Default and Dark.
	 */
	public function test_offers_light_and_dark_with_pele(): void {
		update_option( Options::RENDERER, 'pele' );

		$this->assertSame(
			array(
				'auto'    => 'Automatic',
				'default' => 'Light',
				'dark'    => 'Dark',
			),
			$this->themes->get_offered()
		);
	}

	/**
	 * With Pele, each theme that isn't offered is shown as Dark when it is
	 * dark, and as Light when it isn't.
	 */
	public function test_shows_the_other_themes_as_light_or_dark_with_pele(): void {
		update_option( Options::RENDERER, 'pele' );

		$aliases = $this->themes->get_aliases();

		$this->assertSame( array_keys( array_diff_key( $this->themes->get_all(), $this->themes->get_offered() ) ), array_keys( $aliases ) );

		foreach ( $aliases as $theme => $shown ) {
			$this->assertSame( false !== strpos( $theme, 'dark' ) ? 'dark' : 'default', $shown, $theme );
		}

		$this->assertSame( 'default', $this->themes->get_shown( 'forest' ) );
		$this->assertSame( 'dark', $this->themes->get_shown( 'redux-dark-color' ) );
		$this->assertSame( 'dark', $this->themes->get_shown( 'dark' ) );
		$this->assertSame( 'auto', $this->themes->get_shown( 'auto' ) );
	}

	/**
	 * A filter picks the renderer of a request, and the themes offered
	 * follow it.
	 */
	public function test_offers_the_themes_of_the_renderer_of_the_request(): void {
		update_option( Options::RENDERER, 'pele' );

		$filter = static function () {
			return 'mermaid';
		};
		add_filter( 'graphdraw_renderer', $filter );
		$this->assertSame( $this->themes->get_all(), $this->themes->get_offered() );
		remove_filter( 'graphdraw_renderer', $filter );

		$this->assertCount( 3, $this->themes->get_offered() );
	}

	/**
	 * Offering fewer themes changes nothing a diagram is drawn in: a theme
	 * that isn't offered is still a theme.
	 */
	public function test_keeps_the_themes_that_are_not_offered(): void {
		update_option( Options::RENDERER, 'pele' );
		update_option( Options::THEME, 'forest' );

		$this->assertTrue( $this->themes->exists( 'neo-dark' ) );
		$this->assertSame( 'neo-dark', $this->themes->resolve( 'neo-dark' ) );
		$this->assertSame( 'forest', $this->themes->resolve() );
	}

	/**
	 * The theme that follows the page comes first, and each theme has a label.
	 */
	public function test_lists_the_themes(): void {
		$themes = $this->themes->get_all();

		$this->assertSame( Themes::AUTO, array_key_first( $themes ) );
		$this->assertArrayHasKey( 'dark', $themes );
		$this->assertSame( array_filter( $themes ), $themes );
	}

	/**
	 * Values, with whether they name a theme.
	 *
	 * @return array[] The value, and whether it is a theme.
	 */
	public function data_names(): array {
		return array(
			'a theme'           => array( 'forest', true ),
			'the automatic one' => array( 'auto', true ),
			'an unknown name'   => array( 'no-such-theme', false ),
			'another case'      => array( 'Forest', false ),
			'nothing'           => array( '', false ),
			'null'              => array( null, false ),
			'a list'            => array( array( 'forest' ), false ),
			'a number'          => array( 0, false ),
		);
	}

	/**
	 * Only the name of a theme is one, as text.
	 *
	 * @dataProvider data_names
	 *
	 * @param mixed $value  The value.
	 * @param bool  $exists Whether it is a theme.
	 */
	public function test_tells_whether_a_theme_exists( $value, bool $exists ): void {
		$this->assertSame( $exists, $this->themes->exists( $value ) );
	}

	/**
	 * The site's theme is the stored one. Without one, or with one that is no
	 * theme, it is Automatic.
	 */
	public function test_gives_the_theme_of_the_site(): void {
		delete_option( Options::THEME );
		$this->assertSame( Themes::AUTO, $this->themes->get_site_theme() );

		update_option( Options::THEME, 'forest' );
		$this->assertSame( 'forest', $this->themes->get_site_theme() );

		update_option( Options::THEME, 'no-such-theme' );
		$this->assertSame( Themes::AUTO, $this->themes->get_site_theme() );

		update_option( Options::THEME, array( 'forest' ) );
		$this->assertSame( Themes::AUTO, $this->themes->get_site_theme() );
	}

	/**
	 * A diagram is drawn in its own theme, or else in the site's.
	 */
	public function test_gives_a_diagram_its_theme_or_the_theme_of_the_site(): void {
		update_option( Options::THEME, 'forest' );

		$this->assertSame( 'dark', $this->themes->resolve( 'dark' ) );
		$this->assertSame( 'auto', $this->themes->resolve( 'auto' ) );
		$this->assertSame( 'forest', $this->themes->resolve() );
		$this->assertSame( 'forest', $this->themes->resolve( '' ) );
		$this->assertSame( 'forest', $this->themes->resolve( 'no-such-theme' ) );
		$this->assertSame( 'forest', $this->themes->resolve( null ) );

		// The markup class gives the same, for integrations.
		$this->assertSame( 'dark', graphdraw()->diagram()->get_theme( 'dark' ) );
		$this->assertSame( 'forest', graphdraw()->diagram()->get_theme() );
	}
}
