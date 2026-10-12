import MERMAID_CONFIG from '../utils/mermaid-config';

const DIAGRAM =
	'<div class="mermaid-blocks-diagram"><pre class="mermaid-blocks-diagram__source">graph LR\nA--&gt;B</pre></div>';

const fakeMermaid = () => ( {
	initialize: jest.fn(),
	render: jest.fn( async () => ( { svg: '<svg></svg>' } ) ),
} );

// Lets the render started on load finish.
const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

function loadViewScript() {
	jest.isolateModules( () => {
		require( '../view' );
	} );
}

describe( 'view script', () => {
	afterEach( () => {
		delete window.mermaid;
		delete window.mermaidBlocks;
		document.body.innerHTML = '';
		jest.restoreAllMocks();
	} );

	it( 'renders the diagrams on the page once loaded', async () => {
		window.mermaid = fakeMermaid();
		document.body.innerHTML = DIAGRAM;

		loadViewScript();
		await settle();

		expect( window.mermaid.initialize ).toHaveBeenCalledWith(
			MERMAID_CONFIG
		);
		expect(
			document
				.querySelector( '.mermaid-blocks-diagram' )
				.classList.contains( 'is-rendered' )
		).toBe( true );
	} );

	it( 'exposes render() for diagrams added later', async () => {
		window.mermaid = fakeMermaid();
		window.mermaidBlocks = { existing: true };

		loadViewScript();
		await settle();

		const container = document.createElement( 'div' );
		container.innerHTML = DIAGRAM;
		document.body.appendChild( container );
		await window.mermaidBlocks.render( container );

		expect( window.mermaidBlocks.existing ).toBe( true );
		expect(
			container
				.querySelector( '.mermaid-blocks-diagram' )
				.classList.contains( 'is-rendered' )
		).toBe( true );
	} );

	it( 'warns and renders nothing without Mermaid', async () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		document.body.innerHTML = DIAGRAM;

		loadViewScript();
		await settle();

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenCalled();
		expect(
			document
				.querySelector( '.mermaid-blocks-diagram' )
				.classList.contains( 'is-rendered' )
		).toBe( false );
	} );
} );
