<?php
/**
 * The base of the plugin's abilities.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks\Abilities;

use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * An ability of the WordPress Abilities API: a unit of work with a name,
 * JSON Schemas for its input and output, a permission check and an execute
 * callback, which AI agents and automation discover and run.
 *
 * A subclass defines each part, and get_args() puts them together into what
 * wp_register_ability() takes. AbilitiesRegistrar registers them.
 */
abstract class Ability {

	/**
	 * Returns the name of the ability, with the plugin's namespace, such as
	 * `mermaid-blocks/get-diagram`.
	 *
	 * @return string The name.
	 */
	abstract public function get_name(): string;

	/**
	 * Returns the label of the ability.
	 *
	 * @return string The label.
	 */
	abstract protected function get_label(): string;

	/**
	 * Returns what the ability does, and when to use it.
	 *
	 * @return string The description.
	 */
	abstract protected function get_description(): string;

	/**
	 * Returns the JSON Schema of the ability's output.
	 *
	 * @return array The schema.
	 */
	abstract protected function get_output_schema(): array;

	/**
	 * Tells whether the current user may run the ability with this input.
	 *
	 * @param mixed $input The input, valid against the input schema. Null
	 *                     when the ability takes none.
	 *
	 * @return bool|WP_Error Whether the user may run it.
	 */
	abstract public function check_permissions( $input = null );

	/**
	 * Runs the ability.
	 *
	 * @param mixed $input The input, valid against the input schema. Null
	 *                     when the ability takes none.
	 *
	 * @return mixed|WP_Error The output, valid against the output schema, or
	 *                        the error.
	 */
	abstract public function execute( $input = null );

	/**
	 * Returns the JSON Schema of the ability's input.
	 *
	 * @return array The schema, or an empty array when the ability takes no
	 *               input.
	 */
	protected function get_input_schema(): array {
		return array();
	}

	/**
	 * Tells whether the ability changes nothing.
	 *
	 * Read-only abilities run over GET in the REST API.
	 *
	 * @return bool True when it only reads.
	 */
	protected function is_readonly(): bool {
		return false;
	}

	/**
	 * Tells whether the ability may remove or overwrite something, rather than
	 * only add.
	 *
	 * @return bool True when it is destructive.
	 */
	protected function is_destructive(): bool {
		return false;
	}

	/**
	 * Tells whether running the ability again with the same input changes
	 * nothing more.
	 *
	 * @return bool True when it is idempotent.
	 */
	protected function is_idempotent(): bool {
		return false;
	}

	/**
	 * Returns the arguments to register the ability with.
	 *
	 * @param string $category The slug of the category the ability belongs to.
	 *
	 * @return array The arguments of wp_register_ability().
	 */
	final public function get_args( string $category ): array {
		$args = array(
			'label'               => $this->get_label(),
			'description'         => $this->get_description(),
			'category'            => $category,
			'output_schema'       => $this->get_output_schema(),
			'execute_callback'    => array( $this, 'execute' ),
			'permission_callback' => array( $this, 'check_permissions' ),
			'meta'                => array(
				'annotations'  => array(
					'readonly'    => $this->is_readonly(),
					'destructive' => $this->is_destructive(),
					'idempotent'  => $this->is_idempotent(),
				),
				// For the REST API, the MCP Adapter and other clients.
				'public'       => true,
				// WordPress 7.0 and older don't derive it from `public`.
				'show_in_rest' => true,
			),
		);

		$input_schema = $this->get_input_schema();

		// An ability without input gets none: WordPress passes it only with a schema.
		if ( $input_schema ) {
			$args['input_schema'] = $input_schema;
		}

		return $args;
	}

	/**
	 * Returns an error for the caller.
	 *
	 * @param string $code    The code of the error.
	 * @param string $message The message.
	 * @param int    $status  The HTTP status the REST API answers with.
	 *
	 * @return WP_Error The error.
	 */
	protected function error( string $code, string $message, int $status = 400 ): WP_Error {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
