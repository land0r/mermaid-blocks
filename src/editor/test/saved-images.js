/**
 * `@wordpress/*` packages are externals provided by WordPress at runtime and
 * are not installed in node_modules, so they are mocked as virtual modules.
 */
jest.mock( '@wordpress/api-fetch', () => jest.fn(), { virtual: true } );
jest.mock(
	'@wordpress/data',
	() => ( { select: jest.fn(), subscribe: jest.fn() } ),
	{ virtual: true }
);

// Rendering and drawing have tests of their own.
jest.mock( '../../utils/render-diagram', () => ( {
	renderDiagram: jest.fn(),
} ) );
jest.mock( '../../utils/export-diagram', () => ( {
	...jest.requireActual( '../../utils/export-diagram' ),
	getPngBlob: jest.fn(),
} ) );

// The module remembers that it waited for the editor canvas, so each test
// loads it, and what it imports, anew.
let apiFetch;
let select;
let subscribe;
let watchPost;
let drawImage;
let saveImages;
let renderDiagram;
let getPngBlob;

const SVG = '<svg viewBox="0 0 300 150"><g></g></svg>';
const PATH = '/mermaid-blocks/v1/posts/7/images';

// What the editor says about the post, and the listener that watches it.
let editor;
let listener;
let post;

// The requests sent, and the diagrams the server lists as missing.
let requests;
let missing;

/**
 * Lets the promises a listener started settle.
 */
const settle = async () => {
	for ( let turn = 0; turn < 20; turn++ ) {
		await Promise.resolve();
	}
};

/**
 * Tells the listener that something changed in the editor.
 *
 * @param {Object} changes What changed about the post.
 */
const change = async ( changes = {} ) => {
	Object.assign( post, changes );
	listener();
	await settle();
};

/**
 * Saves the post in the editor, as the Save button or an autosave does.
 *
 * @param {Object}  options          How the save goes.
 * @param {boolean} options.autosave Whether it is an autosave.
 * @param {boolean} options.fails    Whether the request fails.
 */
const save = async ( { autosave = false, fails = false } = {} ) => {
	await change( { saving: true, autosaving: autosave } );
	await change( { saving: false, autosaving: false, succeeded: ! fails } );
};

beforeEach( () => {
	post = { id: 7, saving: false, autosaving: false, succeeded: true };
	editor = {
		getCurrentPostId: () => post.id,
		isSavingPost: () => post.saving,
		isAutosavingPost: () => post.autosaving,
		didPostSaveRequestSucceed: () => post.succeeded,
	};
	requests = [];
	missing = [];

	jest.resetModules();
	apiFetch = require( '@wordpress/api-fetch' );
	( { select, subscribe } = require( '@wordpress/data' ) );
	( { renderDiagram } = require( '../../utils/render-diagram' ) );
	( { getPngBlob } = require( '../../utils/export-diagram' ) );
	( {
		default: watchPost,
		drawImage,
		saveImages,
	} = require( '../saved-images' ) );

	select.mockImplementation( ( store ) =>
		store === 'core/editor' ? editor : null
	);
	subscribe.mockImplementation( ( callback ) => {
		listener = callback;
		return () => {};
	} );

	apiFetch.mockImplementation( ( request ) => {
		requests.push( request );
		return Promise.resolve( request.method ? {} : { missing } );
	} );

	renderDiagram.mockResolvedValue( { svg: SVG } );
	getPngBlob.mockImplementation( ( svg, background ) =>
		Promise.resolve( { png: svg.outerHTML, background } )
	);

	// An editor without a canvas of its own: the admin window has Mermaid.
	window.mermaid = { initialize: jest.fn() };
	jest.useFakeTimers();
} );

afterEach( () => {
	jest.restoreAllMocks();
	jest.useRealTimers();
	delete window.mermaid;
	document.body.innerHTML = '';
} );

/**
 * Runs something that waits for the editor canvas, which never comes here.
 *
 * @param {Function} callback What to run.
 *
 * @return {Promise<*>} What it returned.
 */
const withoutCanvas = async ( callback ) => {
	const result = callback();

	await jest.advanceTimersByTimeAsync( 6000 );

	return result;
};

describe( 'drawImage', () => {
	it( 'draws a diagram in its theme, on the background of that theme', async () => {
		const blob = await withoutCanvas( () =>
			drawImage( 'graph TD', 'dark' )
		);

		expect( renderDiagram ).toHaveBeenCalledWith(
			window.mermaid,
			expect.stringMatching( /^mermaid-blocks-image-\d+$/ ),
			'graph TD',
			document,
			'dark'
		);
		expect( blob ).toEqual( { png: SVG, background: '#333' } );
	} );

	it.each( [ [ 'auto' ], [ '' ], [ undefined ], [ 'no-such-theme' ] ] )(
		'draws a diagram whose theme is %p as on a light page',
		async ( theme ) => {
			const blob = await withoutCanvas( () =>
				drawImage( 'graph TD', theme )
			);

			expect( renderDiagram.mock.calls[ 0 ][ 4 ] ).toBe( 'auto-light' );
			expect( blob.background ).toBe( '#fff' );
		}
	);

	it( 'gives each render an id of its own', async () => {
		await withoutCanvas( () => drawImage( 'graph TD', 'auto' ) );
		await withoutCanvas( () => drawImage( 'graph TD', 'auto' ) );

		expect( renderDiagram.mock.calls[ 0 ][ 1 ] ).not.toBe(
			renderDiagram.mock.calls[ 1 ][ 1 ]
		);
	} );

	it( 'draws with the Mermaid of the editor canvas, once that has loaded', async () => {
		const frame = document.createElement( 'iframe' );
		frame.name = 'editor-canvas';
		document.body.appendChild( frame );

		const drawing = drawImage( 'graph TD', 'forest' );

		await jest.advanceTimersByTimeAsync( 300 );
		expect( renderDiagram ).not.toHaveBeenCalled();

		frame.contentWindow.mermaid = { initialize: jest.fn() };
		await jest.advanceTimersByTimeAsync( 200 );
		await drawing;

		expect( renderDiagram ).toHaveBeenCalledWith(
			frame.contentWindow.mermaid,
			expect.any( String ),
			'graph TD',
			frame.contentWindow.document,
			'forest'
		);
	} );

	it( 'waits for the document of the canvas, which its scripts run before', async () => {
		const frame = document.createElement( 'iframe' );
		frame.name = 'editor-canvas';
		document.body.appendChild( frame );
		frame.contentWindow.mermaid = { initialize: jest.fn() };

		let readyState = 'loading';
		Object.defineProperty( frame.contentWindow.document, 'readyState', {
			get: () => readyState,
		} );

		const drawing = drawImage( 'graph TD', 'auto' );

		await jest.advanceTimersByTimeAsync( 300 );
		expect( renderDiagram ).not.toHaveBeenCalled();

		readyState = 'complete';
		await jest.advanceTimersByTimeAsync( 200 );
		await drawing;

		expect( renderDiagram.mock.calls[ 0 ][ 0 ] ).toBe(
			frame.contentWindow.mermaid
		);
	} );

	it( 'tells when a diagram could not be drawn', async () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		renderDiagram.mockResolvedValue( {
			error: { message: 'boom', line: 1 },
		} );

		await withoutCanvas( () => drawImage( 'graph', 'auto' ) );

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenCalledWith(
			expect.stringContaining( 'could not be drawn' ),
			'boom'
		);
		// eslint-disable-next-line no-console
		console.warn.mockRestore();
	} );

	it( 'waits for the editor canvas once', async () => {
		await withoutCanvas( () => drawImage( 'graph TD', 'auto' ) );

		// No timer has to pass for the second image.
		await expect( drawImage( 'pie', 'auto' ) ).resolves.toEqual( {
			png: SVG,
			background: '#fff',
		} );
	} );

	it( 'draws nothing for a diagram with an error', async () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		renderDiagram.mockResolvedValue( {
			error: { message: 'boom', line: 1 },
		} );

		await expect(
			withoutCanvas( () => drawImage( 'graph', 'auto' ) )
		).resolves.toBeNull();
		expect( getPngBlob ).not.toHaveBeenCalled();
	} );

	it( 'draws nothing without Mermaid', async () => {
		delete window.mermaid;

		await expect(
			withoutCanvas( () => drawImage( 'graph TD', 'auto' ) )
		).resolves.toBeNull();
		expect( renderDiagram ).not.toHaveBeenCalled();
	} );
} );

describe( 'saveImages', () => {
	it( 'asks which diagrams lack an image, and sends one for each', async () => {
		missing = [
			{ key: 'a'.repeat( 32 ), code: 'graph TD', theme: 'auto' },
			{ key: 'b'.repeat( 32 ), code: 'pie', theme: 'forest' },
		];

		const saved = await withoutCanvas( () => saveImages( 7 ) );

		expect( saved ).toBe( 2 );
		expect( requests ).toEqual( [
			{ path: PATH },
			{
				path: `${ PATH }/${ 'a'.repeat( 32 ) }`,
				method: 'POST',
				headers: { 'Content-Type': 'image/png' },
				body: { png: SVG, background: '#fff' },
			},
			{
				path: `${ PATH }/${ 'b'.repeat( 32 ) }`,
				method: 'POST',
				headers: { 'Content-Type': 'image/png' },
				body: { png: SVG, background: '#fff' },
			},
		] );
		expect( renderDiagram.mock.calls.map( ( call ) => call[ 2 ] ) ).toEqual(
			[ 'graph TD', 'pie' ]
		);
	} );

	it( 'draws nothing when no diagram lacks an image', async () => {
		await expect( saveImages( 7 ) ).resolves.toBe( 0 );

		expect( requests ).toEqual( [ { path: PATH } ] );
		expect( renderDiagram ).not.toHaveBeenCalled();
	} );

	it( 'skips a diagram that cannot be drawn, and sends the others', async () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		missing = [
			{ key: 'a'.repeat( 32 ), code: 'graph', theme: 'auto' },
			{ key: 'b'.repeat( 32 ), code: 'pie', theme: 'auto' },
		];
		renderDiagram.mockResolvedValueOnce( {
			error: { message: 'boom', line: 1 },
		} );

		const saved = await withoutCanvas( () => saveImages( 7 ) );

		expect( saved ).toBe( 1 );
		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			PATH,
			`${ PATH }/${ 'b'.repeat( 32 ) }`,
		] );
	} );
} );

describe( 'watchPost', () => {
	beforeEach( () => {
		jest.useRealTimers();
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		// eslint-disable-next-line no-console
		console.warn.mockRestore();
	} );

	it( 'returns what stops the watching', () => {
		const stop = jest.fn();
		subscribe.mockReturnValue( stop );

		expect( watchPost() ).toBe( stop );
	} );

	it( 'checks the post once when the editor opens it', async () => {
		watchPost();

		await change();
		await change();
		await change();

		expect( requests ).toEqual( [ { path: PATH } ] );
	} );

	it( 'checks the post again each time it is saved', async () => {
		watchPost();
		await change();

		await save();
		await save();

		expect( requests ).toEqual( [
			{ path: PATH },
			{ path: PATH },
			{ path: PATH },
		] );
	} );

	it( 'leaves autosaves and failed saves alone', async () => {
		watchPost();
		await change();

		await save( { autosave: true } );
		await save( { fails: true } );

		expect( requests ).toEqual( [ { path: PATH } ] );
	} );

	it( 'checks another post the editor moves to', async () => {
		watchPost();
		await change();

		await change( { id: 8 } );

		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			PATH,
			'/mermaid-blocks/v1/posts/8/images',
		] );
	} );

	it.each( [
		[ 'a template, whose ID is a name', 'twentytwentyfive//page' ],
		[ 'no post yet', null ],
	] )( 'does nothing for %s', async ( _, id ) => {
		watchPost();

		await change( { id } );
		await save();

		expect( requests ).toEqual( [] );
	} );

	it( 'does nothing in an editor that edits no post', async () => {
		select.mockReturnValue( null );
		watchPost();

		await change();

		expect( requests ).toEqual( [] );
	} );

	it( 'waits for the run before it, so no diagram is drawn twice', async () => {
		let answer;
		apiFetch.mockImplementationOnce( ( request ) => {
			requests.push( request );
			return new Promise( ( resolve ) => {
				answer = resolve;
			} );
		} );

		watchPost();
		await change();
		await save();

		expect( requests ).toEqual( [ { path: PATH } ] );

		answer( { missing: [] } );
		await settle();

		expect( requests ).toEqual( [ { path: PATH }, { path: PATH } ] );
	} );

	it( 'keeps watching after a run failed', async () => {
		apiFetch.mockRejectedValueOnce( new Error( 'offline' ) );

		watchPost();
		await change();
		await save();

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenCalledTimes( 1 );
		expect( requests ).toEqual( [ { path: PATH } ] );
	} );
} );
