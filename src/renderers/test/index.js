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
