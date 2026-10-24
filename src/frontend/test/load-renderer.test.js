import MERMAID_CONFIG from '../../utils/mermaid-config';

const MERMAID_URL =
	'https://example.test/build/mermaid/mermaid.esm.min.js?ver=1';
const PELE_URL = 'https://example.test/build/pele/lazy.js?ver=1';
const MATH_URL = 'https://example.test/build/math.js?ver=1';

const mockMermaid = { initialize: jest.fn(), registerIconPacks: jest.fn() };
const mockPele = {
	load: jest.fn(),
	detectType: jest.fn(),
	render: jest.fn(),
	parse: jest.fn(),
};

// Stand in for the modules the browser would import from the URLs.
jest.mock(
	'https://example.test/build/mermaid/mermaid.esm.min.js?ver=1',
	() => ( { __esModule: true, default: mockMermaid } ),
	{ virtual: true }
);
jest.mock(
	'https://example.test/build/pele/lazy.js?ver=1',
	() => ( { __esModule: true, ...mockPele } ),
	{ virtual: true }
);

const mockTypeset = jest.fn();
const mockMathLoaded = jest.fn();

// The math module: the factory runs when it is first imported.
jest.mock(
	'https://example.test/build/math.js?ver=1',
	() => {
		mockMathLoaded();

		return { __esModule: true, typeset: mockTypeset };
	},
	{ virtual: true }
);
jest.mock(
	'https://example.test/build/math.js',
	() => {
		mockMathLoaded();

		return { __esModule: true, typeset: mockTypeset };
	},
	{ virtual: true }
);

// A fresh copy of the module, without the renderer it loaded before.
function getModule() {
	let module;
	jest.isolateModules( () => {
		module = require( '../load-renderer' );
	} );
	return module;
}

describe( 'loadRenderer', () => {
	beforeEach( () => mockMermaid.initialize.mockClear() );

	it( 'loads Mermaid.js for a page that names no renderer', async () => {
		const { default: loadRenderer } = getModule();

		const renderer = await loadRenderer( { mermaidUrl: MERMAID_URL } );

		expect( renderer.name ).toBe( 'mermaid' );
		expect( mockMermaid.initialize ).toHaveBeenCalledWith( MERMAID_CONFIG );
	} );

	it( 'loads Pele, and not Mermaid.js, when the page names it', async () => {
		const { default: loadRenderer } = getModule();

		const renderer = await loadRenderer( {
			renderer: 'pele',
			mermaidUrl: MERMAID_URL,
			peleUrl: PELE_URL,
		} );

		expect( renderer.name ).toBe( 'pele' );
		expect( mockMermaid.initialize ).not.toHaveBeenCalled();
	} );

	it( 'loads a renderer once', async () => {
		const { default: loadRenderer } = getModule();
		const settings = { renderer: 'pele', peleUrl: PELE_URL };

		const [ first, second ] = await Promise.all( [
			loadRenderer( settings ),
			loadRenderer( settings ),
		] );

		expect( first ).toBe( second );
	} );

	it( 'rejects when the renderer cannot be loaded', async () => {
		const { default: loadRenderer } = getModule();

		await expect(
			loadRenderer( {
				renderer: 'pele',
				peleUrl: 'https://example.test/missing.js',
			} )
		).rejects.toThrow();
	} );
} );

describe( 'the math of a Pele diagram', () => {
	const formula = 'flowchart LR\nA["$$x$$"] --> B';
	const draw = ( renderer, code ) =>
		renderer.draw(
			code,
			'auto-light',
			document.createElement( 'div' ),
			'x'
		);

	beforeEach( () => {
		mockMathLoaded.mockClear();
		mockTypeset.mockReset();
		mockPele.render.mockReset();
		mockPele.render.mockReturnValue( { svg: '<svg></svg>' } );
	} );

	it.each( [
		[ 'at the URL the settings give', { mathUrl: MATH_URL } ],
		[
			'next to Pele, for a page cached before the URL existed',
			{ peleUrl: 'https://example.test/build/pele/lazy.js?ver=1' },
		],
	] )(
		'is imported %s, only for a diagram with a formula',
		async ( name, urls ) => {
			const { default: loadRenderer } = getModule();
			const renderer = await loadRenderer( {
				renderer: 'pele',
				peleUrl: PELE_URL,
				...urls,
			} );

			await draw( renderer, 'flowchart LR\nA --> B' );
			expect( mockMathLoaded ).not.toHaveBeenCalled();

			await draw( renderer, formula );
			await draw( renderer, formula );
			expect( mockMathLoaded ).toHaveBeenCalledTimes( 1 );

			// What Pele is given typesets in the diagram's document.
			mockPele.render.mock.lastCall[ 1 ].math( 'x', 16 );
			expect( mockTypeset ).toHaveBeenCalledWith( 'x', 16, document );
		}
	);
} );

describe( 'the icon packs of the site', () => {
	const iconPacks = { fa: 'https://example.test/fa.json' };
	const draw = ( renderer, code ) =>
		renderer.draw(
			code,
			'auto-light',
			document.createElement( 'div' ),
			'x'
		);

	beforeEach( () => {
		mockMermaid.registerIconPacks.mockClear();
		mockPele.render.mockReset();
		mockPele.render.mockReturnValue( { svg: '<svg></svg>' } );
		global.fetch = jest.fn();
	} );

	afterEach( () => {
		delete global.fetch;
	} );

	it( 'are registered with Mermaid.js', async () => {
		const { default: loadRenderer } = getModule();

		await loadRenderer( { mermaidUrl: MERMAID_URL, iconPacks } );

		expect( mockMermaid.registerIconPacks ).toHaveBeenCalledWith( [
			{ name: 'fa', loader: expect.any( Function ) },
		] );
		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'are given to Pele as a resolver, with no fetch for a diagram without icons', async () => {
		const { default: loadRenderer } = getModule();
		const renderer = await loadRenderer( {
			renderer: 'pele',
			peleUrl: PELE_URL,
			iconPacks,
		} );

		await draw( renderer, 'flowchart LR\nA --> B' );

		expect( mockPele.render.mock.lastCall[ 1 ].icons ).toEqual(
			expect.any( Function )
		);
		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'are not registered on a page that has none', async () => {
		const { default: loadRenderer } = getModule();

		await loadRenderer( { mermaidUrl: MERMAID_URL } );

		expect( mockMermaid.registerIconPacks ).not.toHaveBeenCalled();
	} );
} );

describe( 'getRendererUrl', () => {
	it( 'gives the URL of the renderer the page names', () => {
		const { getRendererUrl } = getModule();
		const urls = { mermaidUrl: MERMAID_URL, peleUrl: PELE_URL };

		expect( getRendererUrl( { ...urls, renderer: 'pele' } ) ).toBe(
			PELE_URL
		);
		expect( getRendererUrl( { ...urls, renderer: 'mermaid' } ) ).toBe(
			MERMAID_URL
		);
		expect( getRendererUrl( urls ) ).toBe( MERMAID_URL );
	} );
} );
