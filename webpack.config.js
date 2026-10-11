/**
 * Extends the @wordpress/scripts webpack config to ship the minified Mermaid
 * build (installed from npm) alongside the block assets in `build/`.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const mermaidDir = path.dirname( require.resolve( 'mermaid/package.json' ) );
const mermaidVersion = JSON.parse(
	fs.readFileSync( path.join( mermaidDir, 'package.json' ), 'utf8' )
).version;

const mermaidCopyPlugin = new CopyWebpackPlugin( {
	patterns: [
		{
			from: path.join( mermaidDir, 'dist', 'mermaid.min.js' ),
			to: 'mermaid.min.js',
			// Already minified upstream; keep Terser from re-processing it.
			info: { minimized: true },
		},
		{
			// Emit an asset file so PHP never hardcodes the Mermaid version.
			from: path.join( mermaidDir, 'package.json' ),
			to: 'mermaid.asset.php',
			transform: () =>
				`<?php return array( 'version' => '${ mermaidVersion }' );\n`,
		},
	],
} );

// The default config is an array when module (view script module) builds are
// enabled; copy the files once, from the first (classic script) config only.
if ( Array.isArray( defaultConfig ) ) {
	const [ first, ...rest ] = defaultConfig;
	module.exports = [
		{ ...first, plugins: [ ...first.plugins, mermaidCopyPlugin ] },
		...rest,
	];
} else {
	module.exports = {
		...defaultConfig,
		plugins: [ ...defaultConfig.plugins, mermaidCopyPlugin ],
	};
}
