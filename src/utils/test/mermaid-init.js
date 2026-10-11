import { getMermaid } from '../mermaid-init';
import MERMAID_CONFIG from '../mermaid-config';

const fakeMermaid = () => ( { initialize: jest.fn() } );

describe( 'getMermaid', () => {
	afterEach( () => {
		delete window.mermaid;
	} );

	it( 'prefers the copy loaded in the preview window', () => {
		window.mermaid = fakeMermaid();
		const frameDocument = document.implementation.createHTMLDocument();
		const view = { mermaid: fakeMermaid(), document: frameDocument };

		const owner = getMermaid( view );

		expect( owner.mermaid ).toBe( view.mermaid );
		expect( owner.document ).toBe( frameDocument );
	} );

	it( 'falls back to the admin window copy', () => {
		window.mermaid = fakeMermaid();

		const owner = getMermaid( { document: null } );

		expect( owner.mermaid ).toBe( window.mermaid );
		expect( owner.document ).toBe( document );
	} );

	it( 'falls back when no window is given', () => {
		window.mermaid = fakeMermaid();

		expect( getMermaid().mermaid ).toBe( window.mermaid );
	} );

	it( 'returns null when Mermaid is not loaded anywhere', () => {
		expect( getMermaid( {} ) ).toBeNull();
	} );

	it( 'initialises each copy once, with the front-end configuration', () => {
		const view = { mermaid: fakeMermaid(), document };

		getMermaid( view );
		getMermaid( view );

		expect( view.mermaid.initialize ).toHaveBeenCalledTimes( 1 );
		expect( view.mermaid.initialize ).toHaveBeenCalledWith(
			MERMAID_CONFIG
		);
	} );

	it( 'uses the same configuration as the front end, without the old SVG-label workaround', () => {
		expect( MERMAID_CONFIG ).toEqual( { startOnLoad: false } );
	} );
} );
