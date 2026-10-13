import addControls from '../frontend/controls';

const MERMAID_URL =
	'https://example.test/plugin/build/mermaid/mermaid.esm.min.js?ver=1';
const CONTROLS_URL = 'https://example.test/plugin/build/controls.js?ver=2';

const DIAGRAM =
	'<div class="mermaid-blocks-diagram"><pre class="mermaid-blocks-diagram__source">graph LR\nA--&gt;B</pre></div>';

const mockLoadMermaid = jest.fn();
const mockLoadControls = jest.fn();

jest.mock( '../frontend/load-mermaid', () => ( {
	__esModule: true,
	default: ( ...args ) => mockLoadMermaid( ...args ),
} ) );

// Stands in for the import of the controls, a file of their own.
jest.mock( '../frontend/load-controls', () => ( {
	__esModule: true,
	default: ( ...args ) => mockLoadControls( ...args ),
} ) );

const fakeMermaid = () => ( {
	render: jest.fn( async () => ( {
		svg: '<svg viewBox="0 0 100 50"></svg>',
	} ) ),
} );

/**
 * Stands in for the browser's IntersectionObserver, which jsdom lacks.
 * `scrollIntoView()` reports a diagram as intersecting.
 */
class FakeIntersectionObserver {
	static instance = null;

	constructor( callback ) {
		this.callback = callback;
		this.targets = new Set();
		FakeIntersectionObserver.instance = this;
	}

	observe( target ) {
		this.targets.add( target );
	}

	unobserve( target ) {
		this.targets.delete( target );
	}
}

function scrollIntoView( diagram ) {
	const observer = FakeIntersectionObserver.instance;

	if ( observer.targets.has( diagram ) ) {
		observer.callback( [ { target: diagram, isIntersecting: true } ] );
	}
}

// Lets the renders started so far finish.
const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

function loadViewScript() {
	jest.isolateModules( () => {
		require( '../view' );
	} );
}

const diagrams = () =>
	Array.from( document.querySelectorAll( '.mermaid-blocks-diagram' ) );

describe( 'view script', () => {
	let mermaid;

	beforeEach( () => {
		mermaid = fakeMermaid();
		mockLoadMermaid.mockReset();
		mockLoadMermaid.mockResolvedValue( mermaid );
		mockLoadControls.mockReset();
		mockLoadControls.mockResolvedValue( addControls );
		window.mermaidBlocksSettings = {
			mermaidUrl: MERMAID_URL,
			controlsUrl: CONTROLS_URL,
		};
		window.IntersectionObserver = FakeIntersectionObserver;
	} );

	afterEach( () => {
		delete window.mermaidBlocks;
		delete window.mermaidBlocksSettings;
		delete window.IntersectionObserver;
		FakeIntersectionObserver.instance = null;
		document.body.innerHTML = '';
		document.body.removeAttribute( 'style' );
		jest.restoreAllMocks();
	} );

	it( 'loads Mermaid only once a diagram scrolls into view', async () => {
		document.body.innerHTML = DIAGRAM;

		loadViewScript();
		await settle();

		const [ diagram ] = diagrams();
		expect( mockLoadMermaid ).not.toHaveBeenCalled();
		expect( diagram.classList.contains( 'is-pending' ) ).toBe( true );

		scrollIntoView( diagram );
		await settle();

		expect( mockLoadMermaid ).toHaveBeenCalledWith( MERMAID_URL );
		expect( diagram.classList.contains( 'is-rendered' ) ).toBe( true );
		expect( diagram.classList.contains( 'is-pending' ) ).toBe( false );
	} );

	it( 'renders each diagram when it scrolls into view', async () => {
		document.body.innerHTML = DIAGRAM + DIAGRAM;

		loadViewScript();
		const [ first, second ] = diagrams();
		scrollIntoView( first );
		await settle();

		expect( first.classList.contains( 'is-rendered' ) ).toBe( true );
		expect( second.classList.contains( 'is-rendered' ) ).toBe( false );
		expect( second.classList.contains( 'is-pending' ) ).toBe( true );
		expect( mermaid.render ).toHaveBeenCalledTimes( 1 );

		scrollIntoView( second );
		await settle();

		expect( second.classList.contains( 'is-rendered' ) ).toBe( true );
	} );

	it( 'renders right away without IntersectionObserver', async () => {
		delete window.IntersectionObserver;
		document.body.innerHTML = DIAGRAM;

		loadViewScript();
		await settle();

		expect( diagrams()[ 0 ].classList.contains( 'is-rendered' ) ).toBe(
			true
		);
	} );

	it( 'adds the controls a rendered diagram asks for', async () => {
		window.mermaidBlocksSettings.i18n = { zoomIn: 'Inzoomen' };
		document.body.innerHTML = DIAGRAM + DIAGRAM;
		const [ plain, withControls ] = diagrams();
		withControls.dataset.mermaidControls = 'zoom download';

		loadViewScript();
		scrollIntoView( plain );
		scrollIntoView( withControls );
		await settle();

		expect( plain.querySelector( 'button' ) ).toBeNull();
		expect( withControls.querySelectorAll( 'button' ) ).toHaveLength( 5 );
		expect(
			withControls.querySelector( 'button[aria-label="Inzoomen"]' )
		).not.toBeNull();
		expect( mockLoadControls ).toHaveBeenCalledTimes( 1 );
		expect( mockLoadControls ).toHaveBeenCalledWith( CONTROLS_URL );
	} );

	it.each( [ [ undefined ], [ '' ], [ '  ' ] ] )(
		'loads no controls for a diagram that asks for %p',
		async ( controls ) => {
			document.body.innerHTML = DIAGRAM;
			const [ diagram ] = diagrams();

			if ( controls !== undefined ) {
				diagram.dataset.mermaidControls = controls;
			}

			loadViewScript();
			scrollIntoView( diagram );
			await settle();

			expect( diagram.classList.contains( 'is-rendered' ) ).toBe( true );
			expect( mockLoadControls ).not.toHaveBeenCalled();
		}
	);

	it.each( [
		[ MERMAID_URL, 'https://example.test/plugin/build/controls.js' ],
		[
			'/plugin/build/mermaid/mermaid.esm.min.js?ver=1',
			'http://localhost/plugin/build/controls.js',
		],
	] )(
		'finds the controls next to Mermaid, at %s, on a page that says nothing of them',
		async ( mermaidUrl, expected ) => {
			// A page cached before the controls became a file of their own.
			window.mermaidBlocksSettings = { mermaidUrl };
			document.body.innerHTML = DIAGRAM;
			const [ diagram ] = diagrams();
			diagram.dataset.mermaidControls = 'zoom';

			loadViewScript();
			scrollIntoView( diagram );
			await settle();

			expect( mockLoadControls ).toHaveBeenCalledWith( expected );
			expect( diagram.querySelectorAll( 'button' ) ).toHaveLength( 3 );
		}
	);

	it( 'leaves a diagram as it is when its controls cannot be loaded', async () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		mockLoadControls.mockRejectedValue( new Error( 'Network error' ) );
		document.body.innerHTML = DIAGRAM;
		const [ diagram ] = diagrams();
		diagram.dataset.mermaidControls = 'zoom download';

		loadViewScript();
		scrollIntoView( diagram );
		await settle();

		expect( diagram.classList.contains( 'is-rendered' ) ).toBe( true );
		expect( diagram.classList.contains( 'has-error' ) ).toBe( false );
		expect( diagram.querySelector( 'button' ) ).toBeNull();
		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalled();
	} );

	it( 'adds no controls to a diagram that failed', async () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		mermaid.render.mockRejectedValue( new Error( 'Parse error' ) );
		document.body.innerHTML = DIAGRAM;
		const [ diagram ] = diagrams();
		diagram.dataset.mermaidControls = 'zoom download';

		loadViewScript();
		scrollIntoView( diagram );
		await settle();

		expect( diagram.classList.contains( 'has-error' ) ).toBe( true );
		expect( diagram.querySelector( 'button' ) ).toBeNull();
		expect( mockLoadControls ).not.toHaveBeenCalled();
	} );

	it( 'draws a diagram that follows the page again when the page turns dark', async () => {
		mermaid.initialize = jest.fn();
		document.body.innerHTML = DIAGRAM + DIAGRAM;
		const [ following, themed ] = diagrams();
		following.dataset.mermaidControls = 'zoom';
		themed.dataset.mermaidTheme = 'forest';
		const canvas = ( diagram ) =>
			diagram.querySelector( '.mermaid-blocks-diagram__canvas' );

		loadViewScript();
		scrollIntoView( following );
		scrollIntoView( themed );
		await settle();

		const before = [ canvas( following ), canvas( themed ) ];
		expect( before[ 0 ].dataset.mermaidTheme ).toBe( 'auto-light' );

		// What a dark mode switch does, to the body or the root element.
		document.body.style.backgroundColor = 'rgb(17, 24, 39)';
		await new Promise( ( resolve ) => setTimeout( resolve, 150 ) );
		await settle();

		expect( canvas( following ) ).not.toBe( before[ 0 ] );
		expect( canvas( following ).dataset.mermaidTheme ).toBe( 'auto-dark' );
		expect( following.querySelectorAll( 'button' ) ).toHaveLength( 3 );
		expect(
			following.querySelectorAll( '.mermaid-blocks-diagram__canvas' )
		).toHaveLength( 1 );
		expect( canvas( themed ) ).toBe( before[ 1 ] );
	} );

	it( 'exposes render() for diagrams added later', async () => {
		window.mermaidBlocks = { existing: true };

		loadViewScript();

		const container = document.createElement( 'div' );
		container.innerHTML = DIAGRAM;
		document.body.appendChild( container );
		window.mermaidBlocks.render( container );

		const [ diagram ] = diagrams();
		scrollIntoView( diagram );
		await settle();

		expect( window.mermaidBlocks.existing ).toBe( true );
		expect( diagram.classList.contains( 'is-rendered' ) ).toBe( true );
	} );

	it( 'skips diagrams that are rendered or already waiting', async () => {
		document.body.innerHTML = DIAGRAM + DIAGRAM;

		loadViewScript();
		const [ first, second ] = diagrams();
		scrollIntoView( first );
		await settle();

		const observe = jest.spyOn(
			FakeIntersectionObserver.instance,
			'observe'
		);
		window.mermaidBlocks.render();

		expect( observe ).not.toHaveBeenCalled();
		expect( first.classList.contains( 'is-pending' ) ).toBe( false );
		expect( second.classList.contains( 'is-pending' ) ).toBe( true );
	} );

	it( 'shows the source when Mermaid fails to load', async () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		mockLoadMermaid.mockRejectedValue( new Error( 'Network error' ) );
		document.body.innerHTML = DIAGRAM;

		loadViewScript();
		const [ diagram ] = diagrams();
		scrollIntoView( diagram );
		await settle();

		expect( diagram.classList.contains( 'has-error' ) ).toBe( true );
		expect( diagram.classList.contains( 'is-pending' ) ).toBe( false );
		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalled();
	} );

	it( 'warns and leaves diagrams alone without the URL of Mermaid', async () => {
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		delete window.mermaidBlocksSettings;
		document.body.innerHTML = DIAGRAM;

		loadViewScript();
		await settle();

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenCalled();
		expect( diagrams()[ 0 ].classList.contains( 'is-pending' ) ).toBe(
			false
		);
		expect( mockLoadMermaid ).not.toHaveBeenCalled();
	} );
} );
