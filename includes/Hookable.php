<?php
/**
 * What a part of the plugin that adds hooks to WordPress has.
 *
 * @package GraphDraw
 */

namespace GraphDraw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A part of the plugin that adds hooks to WordPress. Plugin lists the parts
 * and calls hooks() on the requests that need them: see its lists.
 */
interface Hookable {

	/**
	 * Adds the hooks of the part to WordPress.
	 *
	 * It only adds hooks, and does nothing else. Plugin may call it more than
	 * once in a request, for a part created when an action fires: WordPress
	 * keeps a callback once per hook and priority.
	 */
	public function hooks(): void;
}
