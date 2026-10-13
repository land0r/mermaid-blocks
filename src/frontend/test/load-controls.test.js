const CONTROLS_URL = 'https://example.test/build/controls.js?ver=1';

const mockAddControls = jest.fn();

// Stands in for the module the browser would import from CONTROLS_URL.
jest.mock(
	'https://example.test/build/controls.js?ver=1',
	() => ( { __esModule: true, default: mockAddControls } ),
	{ virtual: true }
);

// A fresh copy of the module, without the controls it loaded before.
function getLoadControls() {
	let loadControls;
	jest.isolateModules( () => {
		loadControls = require( '../load-controls' ).default;
	} );
	return loadControls;
}

describe( 'loadControls', () => {
	it( 'loads the controls once', async () => {
		const loadControls = getLoadControls();
		const first = loadControls( CONTROLS_URL );
		const second = loadControls( CONTROLS_URL );

		expect( second ).toBe( first );
		await expect( first ).resolves.toBe( mockAddControls );
	} );

	it( 'rejects on every call when the controls cannot be loaded', async () => {
		const loadControls = getLoadControls();
		const missing = 'https://example.test/missing.js';

		await expect( loadControls( missing ) ).rejects.toThrow();
		await expect( loadControls( missing ) ).rejects.toThrow();
	} );
} );
