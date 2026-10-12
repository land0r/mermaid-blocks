/**
 * Extends the @wordpress/scripts webpack config to build the front-end
 * renderer and to ship Mermaid (installed from npm) alongside the block assets
 * in `build/`: the minified build for the editor, and the code-split ES module
 * build that the front end loads on demand.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const mermaidDir = path.dirname( require.resolve( 'mermaid/package.json' ) );
const mermaidVersion = JSON.parse(
	fs.readFileSync( path.join( mermaidDir, 'package.json' ), 'utf8' )
).version;

/**
 * Rewrites the imports between the files of Mermaid's ES module build from
 * `.mjs` to `.js`, to match the files' new names.
 *
 * Browsers only run a module served with a JavaScript MIME type, and not every
 * server maps `.mjs` to one (WordPress ships its own modules as `.js` too).
 *
 * @param {Buffer} content      The file's content.
 * @param {string} absoluteFrom The file's path.
 *
 * @return {string} The content with `.js` imports.
 */
const toJsImports = ( content, absoluteFrom ) => {
	const code = content
		.toString()
		.replace( /("\.\.?\/[^"]+)\.mjs"/g, '$1.js"' );

	if ( /\.mjs["'`]/.test( code ) ) {
		throw new Error(
			`Unexpected .mjs reference left in ${ absoluteFrom }. Update toJsImports() in webpack.config.js.`
		);
	}

	return code;
};

const mermaidCopyPlugin = new CopyWebpackPlugin( {
	patterns: [
		{
			from: path.join( mermaidDir, 'dist', 'mermaid.min.js' ),
			to: 'mermaid.min.js',
			// Already minified upstream; keep Terser from re-processing it.
			info: { minimized: true },
		},
		{
			// The entry and the chunks it imports, keeping their relative paths.
			context: path.join( mermaidDir, 'dist' ),
			from: '{mermaid.esm.min.mjs,chunks/mermaid.esm.min/*.mjs}',
			to: 'mermaid/[path][name].js',
			transform: toJsImports,
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
