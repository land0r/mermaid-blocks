import { getRenderer } from '..';
import MERMAID_CONFIG from '../../utils/mermaid-config';

const fakeMermaid = () => ( { initialize: jest.fn() } );

describe( 'getRenderer', () => {
	afterEach( () => {
		delete window.mermaid;
	} );

	it( 'prefers the copy loaded in the preview window', () => {
		window.mermaid = fakeMermaid();
		const frameDocument = document.implementation.createHTMLDocument();
		const view = { mermaid: fakeMermaid(), document: frameDocument };

		const renderer = getRenderer( view );

		expect( renderer.document ).toBe( frameDocument );
	} );

	it( 'falls back to the admin window copy', () => {
		window.mermaid = fakeMermaid();

		const renderer = getRenderer( { document: null } );

		expect( renderer.document ).toBe( document );
	} );

	it( 'falls back when no window is given', () => {
		window.mermaid = fakeMermaid();

		expect( getRenderer().document ).toBe( document );
	} );

	it( 'returns null when Mermaid is not loaded anywhere', () => {
		expect( getRenderer( {} ) ).toBeNull();
	} );

	it( 'initialises each copy once, with the front-end configuration', () => {
		const view = { mermaid: fakeMermaid(), document };

		getRenderer( view );
		getRenderer( view );

		expect( view.mermaid.initialize ).toHaveBeenCalledTimes( 1 );
		expect( view.mermaid.initialize ).toHaveBeenCalledWith(
			MERMAID_CONFIG
		);
	} );

	it( 'uses the same configuration as the front end, without the old SVG-label workaround', () => {
		expect( MERMAID_CONFIG.startOnLoad ).toBe( false );
		expect( MERMAID_CONFIG ).not.toHaveProperty( 'htmlLabels' );
	} );
} );

describe( 'the math of the editor preview', () => {
	const MATH_URL = 'https://example.test/build/math.js?ver=1';
	const mockTypeset = jest.fn();

	jest.mock(
		'https://example.test/build/math.js?ver=1',
		() => ( { __esModule: true, typeset: mockTypeset } ),
		{ virtual: true }
	);

	afterEach( () => {
		delete window.mermaidBlocksEditorSettings;
	} );

	it( 'is typeset in the document of the canvas, by the module the server names', async () => {
		window.mermaidBlocksEditorSettings = { mathUrl: MATH_URL };

		let getEditorRenderer;
		jest.isolateModules( () => {
			getEditorRenderer = require( '..' ).getRenderer;
		} );

		const canvas = document.implementation.createHTMLDocument();
		const pele = { render: jest.fn( () => ( { svg: '<svg></svg>' } ) ) };
		const element = canvas.createElement( 'div' );
		const renderer = getEditorRenderer( {
			pele,
			document: canvas,
		} );

		canvas.body.appendChild( element );
		await renderer.draw( 'flowchart LR\nA["$$x$$"]', 'auto', element, 'x' );
		pele.render.mock.lastCall[ 1 ].math( 'x', 16 );

		expect( mockTypeset ).toHaveBeenCalledWith( 'x', 16, canvas );
	} );
} );

describe( 'the icon packs of the editor', () => {
	const iconPacks = { fa: 'https://example.test/fa.json' };

	afterEach( () => {
		delete window.mermaidBlocksEditorSettings;
	} );

	const getEditorRenderer = () => {
		let getter;
		jest.isolateModules( () => {
			getter = require( '..' ).getRenderer;
		} );
		return getter;
	};

	it( 'are registered with the Mermaid.js of the canvas', () => {
		window.mermaidBlocksEditorSettings = { iconPacks };
		const mermaid = { initialize: jest.fn(), registerIconPacks: jest.fn() };

		getEditorRenderer()( { mermaid, document } );

		expect( mermaid.registerIconPacks ).toHaveBeenCalledWith( [
			{ name: 'fa', loader: expect.any( Function ) },
		] );
	} );

	it( 'are given to the Pele of the canvas', async () => {
		window.mermaidBlocksEditorSettings = { iconPacks };
		const pele = { render: jest.fn( () => ( { svg: '<svg></svg>' } ) ) };
		const canvas = document.implementation.createHTMLDocument();
		const element = canvas.createElement( 'div' );
		canvas.body.appendChild( element );

		await getEditorRenderer()( { pele, document: canvas } ).draw(
			'flowchart LR\nA --> B',
			'auto',
			element,
			'x'
		);

		expect( pele.render.mock.lastCall[ 1 ].icons ).toEqual(
			expect.any( Function )
		);
	} );
} );
