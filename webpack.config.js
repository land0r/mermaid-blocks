/**
 * Extends the @wordpress/scripts webpack config to build the front-end
 * renderer, and the controls of diagrams as a module it loads on demand, and
 * to ship Mermaid and Pele (installed from npm) alongside the block assets in
 * `build/`: the single-file build of each for the editor, and the code-split ES
 * module build that the front end loads on demand.
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

const peleDir = path.dirname( require.resolve( 'pele/package.json' ) );
const peleVersion = JSON.parse(
	fs.readFileSync( path.join( peleDir, 'package.json' ), 'utf8' )
).version;

/**
 * Checks that the files of Pele's ES module build import each other by
 * relative `.js` paths, which the copy keeps: any other import would break
 * the build once it is served from `build/pele/`.
 *
 * @param {Buffer} content      The file's content.
 * @param {string} absoluteFrom The file's path.
 *
 * @return {Buffer} The content, as it is.
 */
const checkPeleImports = ( content, absoluteFrom ) => {
	const code = content.toString();
	const imports = [
		...code.matchAll(
			/\b(?:import|export)\s*(?:\{[^}]*\}|\*\s*as\s*\w+)?\s*(?:from)?\s*"([^"]+)"/g
		),
		...code.matchAll( /\bimport\(\s*"([^"]+)"\s*\)/g ),
	].map( ( match ) => match[ 1 ] );

	imports.forEach( ( request ) => {
		if ( ! /^\.\.?\/[^"]+\.js$/.test( request ) ) {
			throw new Error(
				`Unexpected import "${ request }" in ${ absoluteFrom }. Pele's files must import each other by relative .js paths: check the copy in webpack.config.js.`
			);
		}
	} );

	return content;
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
			// Pele's lazy build, for the front end: the entry, and the code of
			// each diagram type, which it imports on first use.
			context: path.join( peleDir, 'dist', 'esm' ),
			from: '**/*.js',
			to: 'pele/[path][name].js',
			transform: checkPeleImports,
			info: { minimized: true },
		},
		{
			// Pele's single-file build, for the editor.
			from: path.join( peleDir, 'dist', 'pele.global.js' ),
			to: 'pele.global.js',
			info: { minimized: true },
		},
		{
			from: path.join( peleDir, 'package.json' ),
			to: 'pele.asset.php',
			transform: () =>
				`<?php return array( 'version' => '${ peleVersion }' );\n`,
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
// includes/Assets.php registers so other integrations can load it too. The
// build only finds entries through `file:` paths in block.json, so add it here,
// with the script of the Elementor widget, a file of its own so a page without
// the widget never loads it.
const withRendererAndMermaid = ( config ) => ( {
	...config,
	entry: () => ( {
		...( typeof config.entry === 'function'
			? config.entry()
			: config.entry ),
		view: path.resolve( __dirname, 'src/view.js' ),
		elementor: path.resolve( __dirname, 'src/elementor.js' ),
	} ),
	plugins: [ ...config.plugins, mermaidCopyPlugin ],
} );

/**
 * The script modules WordPress provides, which the module build imports
 * rather than bundles. The default list of the build doesn't know them yet.
 */
const WORDPRESS_MODULES = [
	'@wordpress/abilities',
	'@wordpress/core-abilities',
];

// The client-side abilities are a script module: the Abilities API is one.
// So are the controls of diagrams, which the front end imports by URL when a
// diagram asks for one (see src/frontend/load-controls.js).
const withModules = ( config ) => ( {
	...config,
	entry: () => ( {
		...( typeof config.entry === 'function'
			? config.entry()
			: config.entry ),
		abilities: path.resolve( __dirname, 'src/abilities/index.js' ),
		controls: path.resolve( __dirname, 'src/frontend/controls.js' ),
	} ),
	plugins: config.plugins.map( ( plugin ) =>
		plugin.constructor.name === 'DependencyExtractionWebpackPlugin'
			? new plugin.constructor( {
					...plugin.options,
					requestToExternalModule: ( request ) =>
						WORDPRESS_MODULES.includes( request )
							? `module ${ request }`
							: undefined,
			  } )
			: plugin
	),
} );

// `--experimental-modules` makes the default config an array: the classic
// scripts, then the script modules. Without the modules, diagrams would get no
// controls, and nothing would say why.
if ( ! Array.isArray( defaultConfig ) ) {
	throw new Error(
		'Build with --experimental-modules, as `npm run build` and `npm start` do: part of the plugin is script modules.'
	);
}

const [ scripts, modules ] = defaultConfig;

module.exports = [ withRendererAndMermaid( scripts ), withModules( modules ) ];
