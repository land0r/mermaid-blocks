/**
 * Registers the abilities that run in the browser, in the block editor:
 * `mermaid-blocks/validate-diagram`, which parses a diagram with the editor's
 * renderer, Mermaid.js or Pele. The server can't parse Mermaid, so its
 * abilities only detect a diagram's type.
 *
 * A script module, as the client-side Abilities API is. It has no access to
 * translations: its texts come translated from
 * includes/Abilities/ClientAbilities.php.
 */

/**
 * WordPress dependencies
 */
import {
	getAbilityCategory,
	registerAbility,
	registerAbilityCategory,
} from '@wordpress/abilities';
import { ready } from '@wordpress/core-abilities';

/**
 * Internal dependencies
 */
import {
	INPUT_SCHEMA,
	NAME,
	OUTPUT_SCHEMA,
	validateDiagram,
} from './validate-diagram';

/**
 * Reads the data the server printed for this module.
 *
 * @return {Object} The category, and the texts of the abilities.
 */
function getData() {
	const element = document.getElementById(
		'wp-script-module-data-mermaid-blocks/abilities'
	);

	try {
		return JSON.parse( element?.textContent || '{}' );
	} catch ( error ) {
		return {};
	}
}

const { category, abilities } = getData();

// The server's categories load first: the abilities' category is one of them.
ready.then( () => {
	if ( ! category || ! abilities ) {
		return;
	}

	if ( ! getAbilityCategory( category.slug ) ) {
		registerAbilityCategory( category.slug, {
			label: category.label,
			description: category.description,
		} );
	}

	registerAbility( {
		name: NAME,
		label: abilities.validateDiagram.label,
		description: abilities.validateDiagram.description,
		category: category.slug,
		input_schema: INPUT_SCHEMA,
		output_schema: OUTPUT_SCHEMA,
		meta: {
			annotations: {
				readonly: true,
				destructive: false,
				idempotent: true,
			},
		},
		callback: validateDiagram,
	} );
} );
