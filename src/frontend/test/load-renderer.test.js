import MERMAID_CONFIG from '../../utils/mermaid-config';

const MERMAID_URL =
	'https://example.test/build/mermaid/mermaid.esm.min.js?ver=1';
const PELE_URL = 'https://example.test/build/pele/lazy.js?ver=1';

const mockMermaid = { initialize: jest.fn() };
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
