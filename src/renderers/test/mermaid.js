import { createMermaidRenderer } from '../mermaid';
import MERMAID_CONFIG from '../../utils/mermaid-config';
import { AUTO_DARK, AUTO_LIGHT } from '../../utils/themes';

// Draws through the renderer interface, in the document of the window.
const renderDiagram = ( mermaid, id, code, doc = document, theme ) =>
	createMermaidRenderer( mermaid, doc ).draw( code, theme, doc.body, id );
const parseDiagram = ( mermaid, code ) =>
	createMermaidRenderer( mermaid ).parse( code );

describe( 'renderDiagram', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'resolves to the svg on success and removes nothing', async () => {
		const bystander = document.createElement( 'div' );
		bystander.id = 'dabc';
		document.body.appendChild( bystander );

		const mermaid = {
			render: jest.fn().mockResolvedValue( { svg: '<svg></svg>' } ),
		};

		await expect(
			renderDiagram( mermaid, 'abc', 'graph' )
		).resolves.toEqual( { svg: '<svg></svg>' } );
		expect( mermaid.render ).toHaveBeenCalledWith( 'abc', 'graph' );
		expect( document.getElementById( 'dabc' ) ).not.toBeNull();
	} );

	it( 'returns the 1-based line and the message for a parse error', async () => {
		// Mermaid's own line number is dropped: it can differ from the line.
		const error = new Error( 'Parse error on line 4:\nboom' );
		error.hash = { line: 3, loc: { first_line: 2 }, expected: [] };
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		await expect(
			renderDiagram( mermaid, 'x', 'graph\nbad\nB' )
		).resolves.toEqual( {
			error: { message: 'boom', line: 2 },
		} );
	} );

	it( 'falls back to hash.line + 1 when loc is missing', async () => {
		const error = new Error( 'oops' );
		error.hash = { line: 3 };
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		const result = await renderDiagram( mermaid, 'x', 'a\nb\nc\nbad' );
		expect( result.error.line ).toBe( 4 );
	} );

	it( 'points at the line of the source, not of the text Mermaid parsed', async () => {
		// Mermaid removes the front matter and the comment before parsing.
		const code = '---\ntitle: T\n---\n%% note\ngraph\nbad';
		const error = new Error( 'Parse error on line 2:\nboom' );
		error.hash = { line: 1, loc: { first_line: 2 } };
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		const result = await renderDiagram( mermaid, 'x', code );
		expect( result.error.line ).toBe( 6 );
	} );

	it( 'reads the errors of diagram types that list them', async () => {
		// The shape pie, gitGraph and other newer diagram types reject with.
		const error = new Error(
			'Parsing failed:  Parse error on line 3, column 10: Expecting token of type `:` but found `85`.'
		);
		error.result = {
			lexerErrors: [],
			parserErrors: [
				{
					message: 'Expecting token of type `:` but found `85`.',
					token: { startLine: 3 },
				},
			],
		};
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		await expect(
			renderDiagram( mermaid, 'x', 'pie\n"Dogs" : 3\n"Cats" 85' )
		).resolves.toEqual( {
			error: {
				message: 'Expecting token of type `:` but found `85`.',
				line: 3,
			},
		} );
	} );

	it( 'reads a lexing error first, and a line-less error as line null', async () => {
		const lexing = new Error( 'Parsing failed: …' );
		lexing.result = {
			lexerErrors: [ { message: 'unexpected character', line: 2 } ],
			parserErrors: [ { message: 'later', token: { startLine: 3 } } ],
		};
		const atEnd = new Error( 'Parsing failed: …' );
		atEnd.result = {
			parserErrors: [ { message: 'early end', token: {} } ],
		};
		const mermaid = {
			render: jest
				.fn()
				.mockRejectedValueOnce( lexing )
				.mockRejectedValueOnce( atEnd ),
		};

		await expect(
			renderDiagram( mermaid, 'x', 'pie\n"a" : 1 ^\n"b" 2' )
		).resolves.toEqual( {
			error: { message: 'unexpected character\nlater', line: 2 },
		} );
		await expect(
			renderDiagram( mermaid, 'x', 'pie\n"a" :' )
		).resolves.toEqual( {
			error: { message: 'early end', line: null },
		} );
	} );

	it( 'returns line null for errors without a hash', async () => {
		const mermaid = {
			render: jest
				.fn()
				.mockRejectedValue( new Error( 'No diagram type detected' ) ),
		};

		await expect( renderDiagram( mermaid, 'x', 'bad' ) ).resolves.toEqual( {
			error: { message: 'No diagram type detected', line: null },
		} );
	} );

	it( 'handles non-Error rejections', async () => {
		const mermaid = { render: jest.fn().mockRejectedValue( 'plain' ) };

		await expect( renderDiagram( mermaid, 'x', 'bad' ) ).resolves.toEqual( {
			error: { message: 'plain', line: null },
		} );
	} );

	it( 'removes orphaned #d<id> and #<id> elements after a failure', async () => {
		[ 'dprobe', 'probe', 'dother' ].forEach( ( id ) => {
			const el = document.createElement( 'div' );
			el.id = id;
			document.body.appendChild( el );
		} );
		const mermaid = {
			render: jest.fn().mockRejectedValue( new Error( 'bad' ) ),
		};

		await renderDiagram( mermaid, 'probe', 'bad' );

		expect( document.getElementById( 'dprobe' ) ).toBeNull();
		expect( document.getElementById( 'probe' ) ).toBeNull();
		expect( document.getElementById( 'dother' ) ).not.toBeNull();
	} );

	it( 'removes leftovers from the document Mermaid rendered in', async () => {
		const frameDocument = document.implementation.createHTMLDocument();
		const orphan = frameDocument.createElement( 'div' );
		orphan.id = 'dframe';
		frameDocument.body.appendChild( orphan );
		const mermaid = {
			render: jest.fn().mockRejectedValue( new Error( 'bad' ) ),
		};

		await renderDiagram( mermaid, 'frame', 'bad', frameDocument );

		expect( frameDocument.getElementById( 'dframe' ) ).toBeNull();
	} );

	it( 'does not throw when there is nothing to clean up', async () => {
		const mermaid = {
			render: jest.fn().mockRejectedValue( new Error( 'bad' ) ),
		};

		await expect(
			renderDiagram( mermaid, 'missing', 'bad' )
		).resolves.toHaveProperty( 'error' );
	} );
} );

describe( 'renderDiagram themes', () => {
	const fakeMermaid = () => ( {
		initialize: jest.fn(),
		render: jest.fn().mockResolvedValue( { svg: '<svg></svg>' } ),
		mermaidAPI: {
			defaultConfig: {
				theme: 'default',
				flowchart: { theme: 'redux-color' },
			},
		},
	} );

	it( 'leaves Mermaid as it was initialised without a theme', async () => {
		const mermaid = fakeMermaid();

		await renderDiagram( mermaid, 'a', 'graph' );
		await renderDiagram( mermaid, 'b', 'graph', document, AUTO_LIGHT );

		expect( mermaid.initialize ).not.toHaveBeenCalled();
		expect( mermaid.render ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'initialises Mermaid with the theme before rendering in it', async () => {
		const mermaid = fakeMermaid();
		const calls = [];
		mermaid.initialize.mockImplementation( () =>
			calls.push( 'initialize' )
		);
		mermaid.render.mockImplementation( async () => {
			calls.push( 'render' );
			return { svg: '<svg></svg>' };
		} );

		await renderDiagram( mermaid, 'a', 'graph', document, 'forest' );

		expect( mermaid.initialize ).toHaveBeenCalledWith( {
			...MERMAID_CONFIG,
			theme: 'forest',
		} );
		expect( calls ).toEqual( [ 'initialize', 'render' ] );
	} );

	it( 'initialises Mermaid again only when the theme changes', async () => {
		const mermaid = fakeMermaid();

		await renderDiagram( mermaid, 'a', 'graph', document, 'forest' );
		await renderDiagram( mermaid, 'b', 'graph', document, 'forest' );

		expect( mermaid.initialize ).toHaveBeenCalledTimes( 1 );

		await renderDiagram( mermaid, 'c', 'graph', document, AUTO_DARK );

		// The dark theme of a type is added to the layout the type has.
		expect( mermaid.initialize ).toHaveBeenLastCalledWith( {
			...MERMAID_CONFIG,
			theme: 'dark',
			flowchart: { layout: 'dagre', theme: 'redux-dark-color' },
		} );

		// Back to what Mermaid picks: no theme is named.
		await renderDiagram( mermaid, 'd', 'graph', document, AUTO_LIGHT );

		expect( mermaid.initialize ).toHaveBeenCalledTimes( 3 );
		expect( mermaid.initialize ).toHaveBeenLastCalledWith( MERMAID_CONFIG );
	} );

	it( 'gives a flowchart whose keyword asks for ELK that layout', async () => {
		const mermaid = fakeMermaid();
		const elk = {
			...MERMAID_CONFIG,
			flowchart: { layout: 'elk' },
		};

		await renderDiagram( mermaid, 'a', 'flowchart-elk LR\nA --> B' );

		expect( mermaid.initialize ).toHaveBeenLastCalledWith( elk );

		// Mermaid removes these before it looks for the keyword.
		await renderDiagram(
			mermaid,
			'b',
			'---\ntitle: T\n---\n%% a comment\n\n  flowchart-elk TD\nA --> B'
		);

		expect( mermaid.initialize ).toHaveBeenCalledTimes( 1 );

		await renderDiagram( mermaid, 'c', 'flowchart LR\nA --> B' );

		expect( mermaid.initialize ).toHaveBeenCalledTimes( 2 );
		expect( mermaid.initialize ).toHaveBeenLastCalledWith( MERMAID_CONFIG );
	} );

	it( 'gives that flowchart ELK in a theme too', async () => {
		const mermaid = fakeMermaid();

		await renderDiagram(
			mermaid,
			'a',
			'flowchart-elk LR\nA --> B',
			document,
			AUTO_DARK
		);

		expect( mermaid.initialize ).toHaveBeenCalledWith( {
			...MERMAID_CONFIG,
			theme: 'dark',
			flowchart: { layout: 'elk', theme: 'redux-dark-color' },
		} );
	} );

	it.each( [
		[
			'a node named after the keyword',
			'flowchart LR\nflowchart-elk --> B',
		],
		[ 'a label with the keyword', 'flowchart LR\nA[flowchart-elk] --> B' ],
		[ 'another diagram type', 'sequenceDiagram\nflowchart-elk->>B: Hi' ],
	] )( 'leaves the layout of %s alone', async ( name, code ) => {
		const mermaid = fakeMermaid();

		await renderDiagram( mermaid, 'a', code );

		expect( mermaid.initialize ).not.toHaveBeenCalled();
	} );

	it( 'keeps the theme of each Mermaid instance apart', async () => {
		const first = fakeMermaid();
		const second = fakeMermaid();

		await renderDiagram( first, 'a', 'graph', document, 'dark' );
		await renderDiagram( second, 'b', 'graph', document, 'dark' );

		expect( first.initialize ).toHaveBeenCalledTimes( 1 );
		expect( second.initialize ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not change the theme while another diagram renders', async () => {
		const mermaid = fakeMermaid();
		const calls = [];
		let finishFirst;

		mermaid.initialize.mockImplementation( ( { theme } ) =>
			calls.push( `initialize ${ theme }` )
		);
		mermaid.render.mockImplementation( ( id ) => {
			calls.push( `start ${ id }` );

			return new Promise( ( resolve ) => {
				const finish = () => {
					calls.push( `end ${ id }` );
					resolve( { svg: '<svg></svg>' } );
				};

				if ( id === 'a' ) {
					finishFirst = finish;
				} else {
					finish();
				}
			} );
		} );

		const first = renderDiagram( mermaid, 'a', 'graph', document, 'dark' );
		const second = renderDiagram(
			mermaid,
			'b',
			'graph',
			document,
			'forest'
		);

		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		expect( calls ).toEqual( [ 'initialize dark', 'start a' ] );

		finishFirst();
		await Promise.all( [ first, second ] );

		expect( calls ).toEqual( [
			'initialize dark',
			'start a',
			'end a',
			'initialize forest',
			'start b',
			'end b',
		] );
	} );

	it( 'renders the next diagram after one that failed', async () => {
		const mermaid = fakeMermaid();
		mermaid.render.mockRejectedValueOnce( new Error( 'bad' ) );

		const [ first, second ] = await Promise.all( [
			renderDiagram( mermaid, 'a', 'bad' ),
			renderDiagram( mermaid, 'b', 'graph' ),
		] );

		expect( first ).toHaveProperty( 'error' );
		expect( second ).toEqual( { svg: '<svg></svg>' } );
	} );

	it( 'does not throw when Mermaid cannot be initialised', async () => {
		const mermaid = fakeMermaid();
		mermaid.initialize.mockImplementation( () => {
			throw new Error( 'Unknown theme' );
		} );

		await expect(
			renderDiagram( mermaid, 'a', 'graph', document, 'forest' )
		).resolves.toEqual( {
			error: { message: 'Unknown theme', line: null },
		} );
		expect( mermaid.render ).not.toHaveBeenCalled();
	} );
} );

describe( 'parseDiagram', () => {
	it( 'resolves to the type Mermaid detected', async () => {
		const mermaid = {
			parse: jest.fn().mockResolvedValue( {
				diagramType: 'flowchart-v2',
				config: {},
			} ),
		};

		await expect( parseDiagram( mermaid, 'graph TD' ) ).resolves.toEqual( {
			type: 'flowchart-v2',
		} );
		expect( mermaid.parse ).toHaveBeenCalledWith( 'graph TD' );
	} );

	it( 'returns the message and the line of the source for an error', async () => {
		const code = '---\ntitle: T\n---\ngraph\nbad';
		const error = new Error( 'Parse error on line 2:\nboom' );
		error.hash = { line: 1, loc: { first_line: 2 } };
		const mermaid = { parse: jest.fn().mockRejectedValue( error ) };

		await expect( parseDiagram( mermaid, code ) ).resolves.toEqual( {
			error: { message: 'boom', line: 5 },
		} );
	} );

	it( 'waits for the render before it', async () => {
		const calls = [];
		let finishRender;
		const mermaid = {
			initialize: jest.fn(),
			render: jest.fn( () => {
				calls.push( 'start render' );

				return new Promise( ( resolve ) => {
					finishRender = () => {
						calls.push( 'end render' );
						resolve( { svg: '<svg></svg>' } );
					};
				} );
			} ),
			parse: jest.fn( async () => {
				calls.push( 'parse' );
				return { diagramType: 'pie' };
			} ),
		};

		const rendered = renderDiagram( mermaid, 'a', 'graph' );
		const parsed = parseDiagram( mermaid, 'pie' );

		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( calls ).toEqual( [ 'start render' ] );

		finishRender();
		await Promise.all( [ rendered, parsed ] );

		expect( calls ).toEqual( [ 'start render', 'end render', 'parse' ] );
	} );
} );

describe( 'icon packs', () => {
	const pack = { prefix: 'fa', icons: { car: { body: '<path/>' } } };
	let n = 0;
	let url;

	const fakeMermaid = () => ( { registerIconPacks: jest.fn() } );

	beforeEach( () => {
		url = `/fa-mermaid-${ ++n }.json`;
		global.fetch = jest.fn( () =>
			Promise.resolve( { ok: true, json: () => Promise.resolve( pack ) } )
		);
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete global.fetch;
	} );

	it( 'registers each pack with a loader, and fetches nothing yet', () => {
		const mermaid = fakeMermaid();

		createMermaidRenderer( mermaid, document, {
			fa: url,
			logos: '/l.json',
		} );

		expect( mermaid.registerIconPacks ).toHaveBeenCalledTimes( 1 );
		expect( mermaid.registerIconPacks ).toHaveBeenCalledWith( [
			{ name: 'fa', loader: expect.any( Function ) },
			{ name: 'logos', loader: expect.any( Function ) },
		] );
		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'loads the Iconify JSON of a pack through the loader, once', async () => {
		const mermaid = fakeMermaid();

		createMermaidRenderer( mermaid, document, { fa: url } );
		const [ [ [ { loader } ] ] ] = mermaid.registerIconPacks.mock.calls;

		await expect( loader() ).resolves.toEqual( pack );
		await loader();

		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'rejects in the loader when the pack failed, for Mermaid to show its own mark', async () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		global.fetch = jest.fn( () =>
			Promise.reject( new Error( 'offline' ) )
		);
		const mermaid = fakeMermaid();

		createMermaidRenderer( mermaid, document, { fa: url } );

		await expect(
			mermaid.registerIconPacks.mock.calls[ 0 ][ 0 ][ 0 ].loader()
		).rejects.toThrow();
	} );

	it( 'registers the packs once per Mermaid, however many renderers', () => {
		const mermaid = fakeMermaid();

		createMermaidRenderer( mermaid, document, { fa: url } );
		createMermaidRenderer( mermaid, document, { fa: url } );

		expect( mermaid.registerIconPacks ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'registers nothing without packs, or with none', () => {
		const mermaid = fakeMermaid();

		createMermaidRenderer( mermaid );
		createMermaidRenderer( mermaid, document, {} );

		expect( mermaid.registerIconPacks ).not.toHaveBeenCalled();
	} );
} );
