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
jest.mock( '../../renderers/mermaid', () => {
	const mockDraw = jest.fn();

	return {
		mockDraw,
		createMermaidRenderer: ( mermaid, { doc } ) => ( {
			name: 'mermaid',
			document: doc,
			draw: mockDraw,
			getStyle: () => null,
		} ),
	};
} );
jest.mock( '../../utils/export-diagram', () => ( {
	...jest.requireActual( '../../utils/export-diagram' ),
	getPngBlob: jest.fn(),
} ) );

import { createPeleRenderer } from '../../renderers/pele';

// The module remembers that it waited for the editor canvas, so each test
// loads it, and what it imports, anew.
let apiFetch;
let select;
let subscribe;
let watchPost;
let drawImage;
let saveImages;
let getRenderer;
let draw;
let getPngBlob;

const SVG = '<svg viewBox="0 0 300 150"><g></g></svg>';
const PATH = '/mermaid-blocks/v1/posts/7/images';
// The editor says which renderer it draws with.
const QUERY = '?renderer=mermaid';
const LIST = PATH + QUERY;

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
	draw = require( '../../renderers/mermaid' ).mockDraw;
	( { getRenderer } = require( '../../renderers' ) );
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

	draw.mockResolvedValue( { svg: SVG } );
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
	// The renderer of an editor without a canvas of its own.
	const getMermaid = () => getRenderer( window );

	// Pele's renderer, with a Pele that draws one SVG.
	const getPele = () =>
		createPeleRenderer( {
			render: () => ( {
				svg: '<svg class="pele" viewBox="0 0 300 150"><g></g></svg>',
			} ),
		} );

	it( 'draws a diagram in its theme, on the background of that theme', async () => {
		const blob = await drawImage( getMermaid(), 'graph TD', 'dark' );

		expect( draw ).toHaveBeenCalledWith(
			'graph TD',
			'dark',
			expect.any( window.HTMLElement ),
			expect.stringMatching( /^mermaid-blocks-image-\d+$/ )
		);
		expect( blob ).toEqual( { png: SVG, background: '#333' } );
	} );

	it.each( [ [ 'auto' ], [ '' ], [ undefined ], [ 'no-such-theme' ] ] )(
		'draws a diagram whose theme is %p as on a light page',
		async ( theme ) => {
			const blob = await drawImage( getMermaid(), 'graph TD', theme );

			expect( draw.mock.calls[ 0 ][ 1 ] ).toBe( 'auto-light' );
			expect( blob.background ).toBe( '#fff' );
		}
	);

	it( 'draws a Pele diagram with the colours of its palette, which give the PNG its background', async () => {
		await drawImage( getPele(), 'graph TD', 'dark' );

		const [ [ svg, background ] ] = getPngBlob.mock.calls;

		expect( background ).toBeUndefined();
		expect( svg.style.getPropertyValue( '--pele-fg' ) ).toBe( '#e6e6e6' );
		expect( svg.style.getPropertyValue( '--pele-bg' ) ).toBe( '#1e1e1e' );
	} );

	it( 'draws a Pele diagram that follows the page as on a light page', async () => {
		await drawImage( getPele(), 'graph TD', 'auto' );

		const [ [ svg ] ] = getPngBlob.mock.calls;

		expect( svg.style.getPropertyValue( '--pele-fg' ) ).toBe( '#1f1f1f' );
		expect( svg.style.getPropertyValue( '--pele-bg' ) ).toBe( '#ffffff' );
	} );

	it( 'draws a Pele diagram in full, for a hidden element with no width', async () => {
		const render = jest.fn( () => ( {
			svg: '<svg class="pele" viewBox="0 0 300 150"><g></g></svg>',
		} ) );

		// The body of the editor has a width, as a page's does.
		Object.defineProperty( document.body, 'clientWidth', {
			configurable: true,
			value: 375,
		} );

		try {
			await drawImage(
				createPeleRenderer( { render } ),
				'flowchart LR\nA-->B',
				'auto'
			);
		} finally {
			delete document.body.clientWidth;
		}

		expect( render.mock.calls[ 0 ][ 1 ] ).not.toHaveProperty( 'maxWidth' );
		expect( document.body.querySelector( '[hidden]' ) ).toBeNull();
	} );

	it( 'gives each render an id of its own', async () => {
		await drawImage( getMermaid(), 'graph TD', 'auto' );
		await drawImage( getMermaid(), 'graph TD', 'auto' );

		expect( draw.mock.calls[ 0 ][ 3 ] ).not.toBe(
			draw.mock.calls[ 1 ][ 3 ]
		);
	} );

	it( 'tells when a diagram could not be drawn, and draws nothing', async () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		draw.mockResolvedValue( {
			error: { message: 'boom', line: 1 },
		} );

		await expect(
			drawImage( getMermaid(), 'graph', 'auto' )
		).resolves.toBeNull();

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenCalledWith(
			expect.stringContaining( 'could not be drawn' ),
			'boom'
		);
		expect( getPngBlob ).not.toHaveBeenCalled();
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
			{ path: LIST },
			{
				path: `${ PATH }/${ 'a'.repeat( 32 ) }${ QUERY }`,
				method: 'POST',
				headers: { 'Content-Type': 'image/png' },
				body: { png: SVG, background: '#fff' },
			},
			{
				path: `${ PATH }/${ 'b'.repeat( 32 ) }${ QUERY }`,
				method: 'POST',
				headers: { 'Content-Type': 'image/png' },
				body: { png: SVG, background: '#fff' },
			},
		] );
		expect( draw.mock.calls.map( ( call ) => call[ 0 ] ) ).toEqual( [
			'graph TD',
			'pie',
		] );
	} );

	it( 'draws nothing when no diagram lacks an image', async () => {
		await expect( withoutCanvas( () => saveImages( 7 ) ) ).resolves.toBe(
			0
		);

		expect( requests ).toEqual( [ { path: LIST } ] );
		expect( draw ).not.toHaveBeenCalled();
	} );

	it( 'skips a diagram that cannot be drawn, and sends the others', async () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		missing = [
			{ key: 'a'.repeat( 32 ), code: 'graph', theme: 'auto' },
			{ key: 'b'.repeat( 32 ), code: 'pie', theme: 'auto' },
		];
		draw.mockResolvedValueOnce( {
			error: { message: 'boom', line: 1 },
		} );

		const saved = await withoutCanvas( () => saveImages( 7 ) );

		expect( saved ).toBe( 1 );
		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			LIST,
			`${ PATH }/${ 'b'.repeat( 32 ) }${ QUERY }`,
		] );
	} );

	it( 'draws with the Mermaid of the editor canvas, once that has loaded', async () => {
		missing = [
			{ key: 'a'.repeat( 32 ), code: 'graph TD', theme: 'forest' },
		];
		const frame = document.createElement( 'iframe' );
		frame.name = 'editor-canvas';
		document.body.appendChild( frame );

		const saving = saveImages( 7 );

		await jest.advanceTimersByTimeAsync( 300 );
		expect( requests ).toEqual( [] );

		frame.contentWindow.mermaid = { initialize: jest.fn() };
		await jest.advanceTimersByTimeAsync( 200 );
		await saving;

		expect( draw ).toHaveBeenCalledWith(
			'graph TD',
			'forest',
			expect.any( frame.contentWindow.HTMLElement ),
			expect.any( String )
		);
	} );

	it( 'waits for the document of the canvas, which its scripts run before', async () => {
		missing = [
			{ key: 'a'.repeat( 32 ), code: 'graph TD', theme: 'auto' },
		];
		const frame = document.createElement( 'iframe' );
		frame.name = 'editor-canvas';
		document.body.appendChild( frame );
		frame.contentWindow.mermaid = { initialize: jest.fn() };

		let readyState = 'loading';
		Object.defineProperty( frame.contentWindow.document, 'readyState', {
			get: () => readyState,
		} );

		const saving = saveImages( 7 );

		await jest.advanceTimersByTimeAsync( 300 );
		expect( draw ).not.toHaveBeenCalled();

		readyState = 'complete';
		await jest.advanceTimersByTimeAsync( 200 );
		await saving;

		expect( draw.mock.calls[ 0 ][ 2 ].ownerDocument ).toBe(
			frame.contentWindow.document
		);
	} );

	it( 'waits for the editor canvas once', async () => {
		await withoutCanvas( () => saveImages( 7 ) );
		missing = [ { key: 'a'.repeat( 32 ), code: 'pie', theme: 'auto' } ];

		// No timer has to pass for the second run.
		await expect( saveImages( 7 ) ).resolves.toBe( 1 );
	} );
} );

describe( 'saveImages and the renderer', () => {
	it( 'asks for the images of the renderer of the editor canvas, and sends them with its name', async () => {
		missing = [ { key: 'a'.repeat( 32 ), code: 'graph', theme: 'auto' } ];
		const frame = document.createElement( 'iframe' );
		frame.name = 'editor-canvas';
		document.body.appendChild( frame );
		frame.contentWindow.pele = {
			render: jest.fn( () => ( { svg: SVG } ) ),
		};

		await saveImages( 7 );

		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			`${ PATH }?renderer=pele`,
			`${ PATH }/${ 'a'.repeat( 32 ) }?renderer=pele`,
		] );
	} );

	it( 'does nothing where no renderer is loaded', async () => {
		delete window.mermaid;

		await expect( withoutCanvas( () => saveImages( 7 ) ) ).resolves.toBe(
			0
		);
		expect( requests ).toEqual( [] );
	} );
} );

describe( 'watchPost', () => {
	beforeEach( () => {
		jest.useRealTimers();

		// The editor canvas has loaded, so a run needn't wait for it.
		const frame = document.createElement( 'iframe' );
		frame.name = 'editor-canvas';
		document.body.appendChild( frame );
		frame.contentWindow.mermaid = { initialize: jest.fn() };
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

		expect( requests ).toEqual( [ { path: LIST } ] );
	} );

	it( 'checks the post again each time it is saved', async () => {
		watchPost();
		await change();

		await save();
		await save();

		expect( requests ).toEqual( [
			{ path: LIST },
			{ path: LIST },
			{ path: LIST },
		] );
	} );

	it( 'leaves autosaves and failed saves alone', async () => {
		watchPost();
		await change();

		await save( { autosave: true } );
		await save( { fails: true } );

		expect( requests ).toEqual( [ { path: LIST } ] );
	} );

	it( 'checks another post the editor moves to', async () => {
		watchPost();
		await change();

		await change( { id: 8 } );

		expect( requests.map( ( request ) => request.path ) ).toEqual( [
			LIST,
			`/mermaid-blocks/v1/posts/8/images${ QUERY }`,
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

		expect( requests ).toEqual( [ { path: LIST } ] );

		answer( { missing: [] } );
		await settle();

		expect( requests ).toEqual( [ { path: LIST }, { path: LIST } ] );
	} );

	it( 'keeps watching after a run failed', async () => {
		apiFetch.mockRejectedValueOnce( new Error( 'offline' ) );

		watchPost();
		await change();
		await save();

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenCalledTimes( 1 );
		expect( requests ).toEqual( [ { path: LIST } ] );
	} );
} );
