<?php
/**
 * The icon packs a site registers.
 *
 * @package GraphDraw
 */

namespace GraphDraw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the `graphdraw_icon_packs` filter, and keeps the packs that have
 * a valid name and URL. The front end and the editor are told the result, with
 * either renderer: both draw the icons of these packs, and only these. Diagram
 * authors never register a pack.
 */
final class IconPacks {

	/**
	 * Returns the packs the filter gave, without what can't be one.
	 *
	 * @return array The URL of the Iconify JSON file of each pack, by the
	 *               pack's name. Empty for none.
	 */
	public function get_settings(): array {
		/**
		 * Filters the icon packs diagrams can use, such as `fa:fa-car`,
		 * `@{ icon: "fa:user" }` or an architecture diagram's `(logos:aws)`.
		 *
		 * A pack is the URL of an Iconify JSON file, by the name diagrams use
		 * before the colon. A name has lower-case letters, digits and hyphens;
		 * anything else is dropped, and so is a value that is no http or https URL. The file
		 * is fetched by the browser, only on a page with a diagram that uses
		 * one of its icons, and its icons are put into the diagram as they
		 * are: register packs you trust.
		 *
		 * Example:
		 *
		 *     add_filter(
		 *         'graphdraw_icon_packs',
		 *         function ( $packs ) {
		 *             $packs['logos'] = 'https://cdn.jsdelivr.net/npm/@iconify-json/logos@1.2.10/icons.json';
		 *
		 *             return $packs;
		 *         }
		 *     );
		 *
		 * @param array $packs The URL of each pack's file, by name. Empty by default.
		 */
		$filtered = apply_filters( 'graphdraw_icon_packs', array() );

		return is_array( $filtered ) ? $this->sanitize( $filtered ) : array();
	}

	/**
	 * Adds the packs to what a script is told, as `iconPacks`: only when the
	 * filter gave some.
	 *
	 * @param array $settings What the script is told.
	 *
	 * @return array The settings, with the packs when there are some.
	 */
	public function add_to( array $settings ): array {
		$packs = $this->get_settings();

		if ( $packs ) {
			$settings['iconPacks'] = $packs;
		}

		return $settings;
	}

	/**
	 * Keeps the packs with a valid name and URL.
	 *
	 * @param array $filtered What the filter gave.
	 *
	 * @return array The URL of each pack, by name.
	 */
	private function sanitize( array $filtered ): array {
		$packs = array();

		foreach ( $filtered as $name => $url ) {
			$name = (string) $name;

			if ( 1 !== preg_match( '/^[a-z0-9-]+$/D', $name ) || ! is_string( $url ) ) {
				continue;
			}

			$url = esc_url_raw( $url, array( 'http', 'https' ) );

			if ( '' !== $url ) {
				$packs[ $name ] = $url;
			}
		}

		return $packs;
	}
}
