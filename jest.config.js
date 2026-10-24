/**
 * The default configuration of `wp-scripts test-unit-js`, and Pele (an ES
 * module package) run through Babel, to draw with the real one.
 */
const config = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...config,
	transformIgnorePatterns: [ '/node_modules/(?!pele/)' ],
};
