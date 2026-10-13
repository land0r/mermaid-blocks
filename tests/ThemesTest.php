<?php
/**
 * Tests of the themes.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Tests;

use MermaidBlocks\Options;
use MermaidBlocks\Themes;
use WP_UnitTestCase;

/**
 * The themes a diagram can be drawn in, and the one a diagram gets.
 *
 * @covers \MermaidBlocks\Themes
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

		$this->themes = mermaid_blocks()->themes();
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
		$this->assertSame( 'dark', mermaid_blocks()->diagram()->get_theme( 'dark' ) );
		$this->assertSame( 'forest', mermaid_blocks()->diagram()->get_theme() );
	}
}
