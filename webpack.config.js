/**
 * Extends the @wordpress/scripts webpack config to build the front-end
 * renderer and to ship the minified Mermaid build (installed from npm)
 * alongside the block assets in `build/`.
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

// block.json refers to the front-end renderer by its script handle, which
// includes/diagram.php registers so other integrations can load it too. The
// build only finds entries through `file:` paths in block.json, so add it here.
const withRendererAndMermaid = ( config ) => ( {
	...config,
	entry: () => ( {
		...( typeof config.entry === 'function'
			? config.entry()
			: config.entry ),
		view: path.resolve( __dirname, 'src/view.js' ),
	} ),
	plugins: [ ...config.plugins, mermaidCopyPlugin ],
} );

// The default config is an array when module (view script module) builds are
// enabled; extend the first (classic script) config only.
if ( Array.isArray( defaultConfig ) ) {
	const [ first, ...rest ] = defaultConfig;
	module.exports = [ withRendererAndMermaid( first ), ...rest ];
} else {
	module.exports = withRendererAndMermaid( defaultConfig );
}
