<?php
/**
 * What a script needs to build its renderer.
 *
 * @package GraphDraw
 */

namespace GraphDraw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Puts together the part of what the front end and the editor are told that is
 * the same for both: where the math module is, the options a site gives Pele
 * and the icon packs it registers. Each script adds the rest.
 */
final class RendererSettings {

	/**
	 * The plugin's files, to find the math module.
	 *
	 * @var Files
	 */
	private Files $files;

	/**
	 * The options a site gives Pele.
	 *
	 * @var PeleOptions
	 */
	private PeleOptions $pele_options;

	/**
	 * The icon packs a site registers.
	 *
	 * @var IconPacks
	 */
	private IconPacks $icon_packs;

	/**
	 * Sets up the settings.
	 *
	 * @param Files       $files        The plugin's files.
	 * @param PeleOptions $pele_options The options a site gives Pele.
	 * @param IconPacks   $icon_packs   The icon packs a site registers.
	 */
	public function __construct( Files $files, PeleOptions $pele_options, IconPacks $icon_packs ) {
		$this->files        = $files;
		$this->pele_options = $pele_options;
		$this->icon_packs   = $icon_packs;
	}

	/**
	 * Adds to what a script is told the URL of the math module, as `mathUrl`;
	 * the options of Pele, as `peleOptions`, only with Pele and only when the
	 * filter gave some; and the icon packs, as `iconPacks`, with either
	 * renderer and only when the filter gave some.
	 *
	 * @param array $settings What the script is told.
	 *
	 * @return array The settings, with these added.
	 */
	public function add_to( array $settings ): array {
		$math = $this->files->get_build_asset( 'math' );

		$settings['mathUrl'] = add_query_arg( 'ver', $math['version'], $this->files->get_build_url( 'math.js' ) );

		return $this->icon_packs->add_to( $this->pele_options->add_to( $settings ) );
	}
}
