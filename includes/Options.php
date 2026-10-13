<?php
/**
 * What the plugin's settings are set to.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the plugin's settings, each stored in an option. It only reads, on
 * any request: Admin\SettingsPage is the page that changes them, and
 * `uninstall.php` deletes them.
 */
final class Options {

	/**
	 * The option that holds the site's theme: see Themes::get_site_theme().
	 */
	const THEME = 'mermaid_blocks_theme';

	/**
	 * The option that switches on showing code marked as Mermaid as diagrams:
	 * see Integrations\CodeBlocks.
	 */
	const CODE_BLOCKS = 'mermaid_blocks_code_blocks';

	/**
	 * The option that switches on saving an image of each diagram: see
	 * Images\SavedImages.
	 */
	const SAVE_IMAGES = 'mermaid_blocks_save_images';

	/**
	 * Every option of the plugin. `uninstall.php` deletes each of them: a unit
	 * test tells when it misses one.
	 */
	const ALL = array( self::THEME, self::CODE_BLOCKS, self::SAVE_IMAGES );

	/**
	 * Returns the theme stored for the site, as it is stored.
	 *
	 * @return string The name of a theme, or an empty string when none is
	 *                stored. It isn't checked: Themes::get_site_theme() is.
	 */
	public function get_theme(): string {
		$theme = get_option( self::THEME, '' );

		return is_string( $theme ) ? $theme : '';
	}

	/**
	 * Tells whether a setting that is on or off is on.
	 *
	 * @param string $option The option that holds the setting.
	 *
	 * @return bool Whether it is on. A setting that was never saved is off.
	 */
	public function is_on( string $option ): bool {
		return (bool) get_option( $option, false );
	}
}
