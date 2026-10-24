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

/**
 * Returns where an npm package is installed, and its version.
 *
 * @param {string} name The package's name.
 *
 * @return {{dir: string, version: string}} Its directory and its version.
 */
const getPackage = ( name ) => {
	const dir = path.dirname( require.resolve( `${ name }/package.json` ) );
	const { version } = JSON.parse(
		fs.readFileSync( path.join( dir, 'package.json' ), 'utf8' )
	);

	return { dir, version };
};

/**
 * Returns the copy that emits the asset file of a library, so PHP never
 * hardcodes its version.
 *
 * @param {string} name The name of the file, before `.asset.php`.
 * @param {Object} pkg  The library's package: see getPackage().
 *
 * @return {Object} A pattern of the copy plugin.
 */
const versionAsset = ( name, pkg ) => ( {
	from: path.join( pkg.dir, 'package.json' ),
	to: `${ name }.asset.php`,
	transform: () => `<?php return array( 'version' => '${ pkg.version }' );\n`,
} );

const mermaid = getPackage( 'mermaid' );
const pele = getPackage( 'pele' );

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
		// `import "x"`, `import a from "x"`, `import { a } from "x"`, `export * from "x"`.
		...code.matchAll( /\b(?:import|export)\b[^"'`;(]*?(["'])([^"']+)\1/g ),
		// `import("x")`.
		...code.matchAll( /\bimport\(\s*(["'])([^"']+)\1\s*\)/g ),
	].map( ( match ) => match[ 2 ] );

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
			from: path.join( mermaid.dir, 'dist', 'mermaid.min.js' ),
			to: 'mermaid.min.js',
			// Already minified upstream; keep Terser from re-processing it.
			info: { minimized: true },
		},
		{
			// The entry and the chunks it imports, keeping their relative paths.
			context: path.join( mermaid.dir, 'dist' ),
			from: '{mermaid.esm.min.mjs,chunks/mermaid.esm.min/*.mjs}',
			to: 'mermaid/[path][name].js',
			transform: toJsImports,
			info: { minimized: true },
		},
		{
			// Pele's lazy build, for the front end: the entry, and the code of
			// each diagram type, which it imports on first use.
			context: path.join( pele.dir, 'dist', 'esm' ),
			from: '**/*.js',
			to: 'pele/[path][name].js',
			transform: checkPeleImports,
			info: { minimized: true },
		},
		{
			// Pele's single-file build, for the editor.
			from: path.join( pele.dir, 'dist', 'pele.global.js' ),
			to: 'pele.global.js',
			info: { minimized: true },
		},
		versionAsset( 'pele', pele ),
		versionAsset( 'mermaid', mermaid ),
	],
} );

// block.json refers to the front-end renderer by its script handle, which
// includes/Assets.php registers so other integrations can load it too. The
// build only finds entries through `file:` paths in block.json, so add it here,
// with the scripts of the Elementor widget, files of their own so a page
// without the widget never loads them: the one of its diagrams, and the one of
// Elementor's editor.
const withRendererAndMermaid = ( config ) => ( {
	...config,
	entry: () => ( {
		...( typeof config.entry === 'function'
			? config.entry()
			: config.entry ),
		view: path.resolve( __dirname, 'src/view.js' ),
		elementor: path.resolve( __dirname, 'src/elementor.js' ),
		'elementor-editor': path.resolve(
			__dirname,
			'src/elementor-editor.js'
		),
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
// diagram asks for one (see src/frontend/load-controls.js), and the math
// module, which a Pele diagram with a formula imports (src/utils/load-math.js).
const withModules = ( config ) => ( {
	...config,
	entry: () => ( {
		...( typeof config.entry === 'function'
			? config.entry()
			: config.entry ),
		abilities: path.resolve( __dirname, 'src/abilities/index.js' ),
		controls: path.resolve( __dirname, 'src/frontend/controls.js' ),
		math: path.resolve( __dirname, 'src/frontend/math.js' ),
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
