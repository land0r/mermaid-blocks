const defaultConfig = require( '@wordpress/scripts/config/.eslintrc.js' );

module.exports = {
	...defaultConfig,
	rules: {
		...defaultConfig.rules,
		'@wordpress/i18n-text-domain': [
			'error',
			{ allowedTextDomain: 'mermaid-blocks' },
		],
	},
};
