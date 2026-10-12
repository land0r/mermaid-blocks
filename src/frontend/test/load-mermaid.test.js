import MERMAID_CONFIG from '../../utils/mermaid-config';

const MERMAID_URL =
	'https://example.test/build/mermaid/mermaid.esm.min.js?ver=1';

const mockMermaid = {
	initialize: jest.fn(),
};

// Stands in for the module the browser would import from MERMAID_URL.
jest.mock(
	'https://example.test/build/mermaid/mermaid.esm.min.js?ver=1',
	() => ( { __esModule: true, default: mockMermaid } ),
	{ virtual: true }
);

// A fresh copy of the module, without the Mermaid it loaded before.
function getLoadMermaid() {
	let loadMermaid;
	jest.isolateModules( () => {
		loadMermaid = require( '../load-mermaid' ).default;
	} );
	return loadMermaid;
}

describe( 'loadMermaid', () => {
	beforeEach( () => mockMermaid.initialize.mockClear() );

	it( 'loads Mermaid once and initialises it with the shared config', async () => {
		const loadMermaid = getLoadMermaid();

		const [ first, second ] = await Promise.all( [
			loadMermaid( MERMAID_URL ),
			loadMermaid( MERMAID_URL ),
		] );

		expect( first ).toBe( mockMermaid );
		expect( second ).toBe( mockMermaid );
		expect( mockMermaid.initialize ).toHaveBeenCalledTimes( 1 );
		expect( mockMermaid.initialize ).toHaveBeenCalledWith( MERMAID_CONFIG );
	} );

	it( 'rejects on every call when Mermaid cannot be loaded', async () => {
		const loadMermaid = getLoadMermaid();
		const missing = 'https://example.test/missing.js';

		await expect( loadMermaid( missing ) ).rejects.toThrow();
		await expect( loadMermaid( missing ) ).rejects.toThrow();
		expect( mockMermaid.initialize ).not.toHaveBeenCalled();
	} );
} );
