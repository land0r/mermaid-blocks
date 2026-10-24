import addControls from '../controls';
import { REDRAWN_EVENT } from '../../utils/redrawn-event';
import { downloadDiagram } from '../../utils/export-diagram';

jest.mock( '../../utils/export-diagram', () => ( {
	downloadDiagram: jest.fn(),
} ) );

const SVG = '<svg width="100%" viewBox="0 0 800 400"></svg>';

/**
 * Builds a rendered diagram, as render-diagrams.js leaves it.
 *
 * @param {string|null} controls The `data-mermaid-controls` attribute.
 * @param {string}      svg      The rendered SVG.
 */
function setup( controls, svg = SVG ) {
	document.body.innerHTML =
		'<div class="mermaid-blocks-diagram is-rendered">' +
		'<pre class="mermaid-blocks-diagram__source" hidden>graph LR</pre>' +
		`<div class="mermaid-blocks-diagram__canvas">${ svg }</div>` +
		'</div>';

	const diagram = document.body.firstElementChild;

	if ( controls !== null ) {
		diagram.dataset.mermaidControls = controls;
	}

	// jsdom lays nothing out: give the diagram a size, so it can be zoomed.
	diagram.querySelector( 'svg' ).getBoundingClientRect = () => ( {
		left: 0,
		top: 0,
		width: 400,
		height: 200,
	} );

	return diagram;
}

const toolbar = ( diagram ) =>
	diagram.querySelector( '.mermaid-blocks-diagram__toolbar' );

const labels = ( diagram ) =>
	Array.from( diagram.querySelectorAll( 'button' ) ).map( ( button ) =>
		button.getAttribute( 'aria-label' )
	);

const button = ( diagram, label ) =>
	diagram.querySelector( `button[aria-label="${ label }"]` );

const isDisabled = ( diagram, label ) =>
	button( diagram, label ).getAttribute( 'aria-disabled' ) === 'true';

// Lets a download that was started finish.
const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

/**
 * Gives the page a clipboard, or takes it away, as on a page served over
 * HTTP.
 *
 * @param {Object|null} clipboard The clipboard, or null for none.
 *
 * @return {Object|null} The clipboard.
 */
function mockClipboard(
	clipboard = { writeText: jest.fn().mockResolvedValue() }
) {
	Object.defineProperty( window.navigator, 'clipboard', {
		configurable: true,
		value: clipboard,
	} );

	return clipboard;
}

describe( 'addControls', () => {
	beforeEach( () => {
		downloadDiagram.mockReset();
		downloadDiagram.mockResolvedValue();
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		jest.useRealTimers();
		delete window.navigator.clipboard;
		// A diagram that is still fullscreen keeps the page from scrolling.
		document.documentElement.style.overflow = '';
	} );

	it.each( [ [ null ], [ '' ], [ 'unknown' ] ] )(
		'adds nothing to a diagram that asks for no controls (%p)',
		( controls ) => {
			const diagram = setup( controls );

			addControls( diagram );

			expect( toolbar( diagram ) ).toBeNull();
		}
	);

	it( 'adds the zoom buttons', () => {
		const diagram = setup( 'zoom' );

		addControls( diagram );

		expect( labels( diagram ) ).toEqual( [
			'Zoom out',
			'Zoom in',
			'Reset zoom',
		] );
	} );

	describe( 'a Pele diagram', () => {
		const zoomLabels = { zoomIn: 'In', zoomOut: 'Out', resetZoom: 'Back' };

		const peleRenderer = ( zoom = {} ) => ( {
			name: 'pele',
			enableZoom: jest.fn( () => ( {
				reset: jest.fn(),
				refresh: jest.fn(),
				...zoom,
			} ) ),
		} );

		it( 'gets the zoom of Pele, with the translated labels, and not the buttons of the plugin', () => {
			const diagram = setup( 'zoom' );
			const renderer = peleRenderer();

			addControls( diagram, zoomLabels, renderer );

			expect( renderer.enableZoom ).toHaveBeenCalledTimes( 1 );
			expect( renderer.enableZoom ).toHaveBeenCalledWith(
				diagram.querySelector( '.mermaid-blocks-diagram__canvas' ),
				{
					always: true,
					labels: { zoomIn: 'In', zoomOut: 'Out', reset: 'Back' },
				}
			);
			expect( labels( diagram ) ).toEqual( [] );
		} );

		it( 'keeps the other controls in the toolbar of the plugin', () => {
			const diagram = setup( 'zoom download fullscreen' );

			addControls( diagram, undefined, peleRenderer() );

			expect( labels( diagram ) ).toEqual( [
				'Download as SVG',
				'Download as PNG',
				'View fullscreen',
			] );
		} );

		it( 'gets no zoom without the control', () => {
			const diagram = setup( 'download' );
			const renderer = peleRenderer();

			addControls( diagram, undefined, renderer );

			expect( renderer.enableZoom ).not.toHaveBeenCalled();
		} );

		it( 'is zoomed once, however many times it gets its controls', () => {
			const diagram = setup( 'zoom' );
			const renderer = peleRenderer();

			addControls( diagram, undefined, renderer );
			addControls( diagram, undefined, renderer );

			expect( renderer.enableZoom ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'refreshes its zoom when it was drawn again', () => {
			const diagram = setup( 'zoom' );
			const refresh = jest.fn();

			addControls( diagram, undefined, peleRenderer( { refresh } ) );
			diagram.dispatchEvent( new CustomEvent( REDRAWN_EVENT ) );

			expect( refresh ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'resets its zoom going fullscreen and leaving it', () => {
			const diagram = setup( 'zoom fullscreen' );
			const reset = jest.fn();

			addControls( diagram, undefined, peleRenderer( { reset } ) );
			button( diagram, 'View fullscreen' ).click();

			expect( reset ).toHaveBeenCalledTimes( 1 );

			button( diagram, 'Exit fullscreen' ).click();

			expect( reset ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	it( 'gives a diagram of Mermaid.js the zoom buttons of the plugin', () => {
		const diagram = setup( 'zoom' );

		addControls( diagram, undefined, { name: 'mermaid' } );

		expect( labels( diagram ) ).toEqual( [
			'Zoom out',
			'Zoom in',
			'Reset zoom',
		] );
	} );

	it( 'adds the download buttons', () => {
		const diagram = setup( 'download' );

		addControls( diagram );

		expect( labels( diagram ) ).toEqual( [
			'Download as SVG',
			'Download as PNG',
		] );
		expect( button( diagram, 'Download as PNG' ).textContent ).toBe(
			'PNG'
		);
	} );

	it( 'puts a labelled group of buttons above the diagram', () => {
		const diagram = setup( 'zoom download' );

		addControls( diagram );

		const group = toolbar( diagram );
		expect( group.getAttribute( 'role' ) ).toBe( 'group' );
		expect( group.getAttribute( 'aria-label' ) ).toBe( 'Diagram controls' );
		expect( group.nextElementSibling.className ).toBe(
			'mermaid-blocks-diagram__canvas'
		);
		expect( labels( diagram ) ).toHaveLength( 5 );
		diagram.querySelectorAll( 'button' ).forEach( ( element ) => {
			expect( element.type ).toBe( 'button' );
			expect( element.title ).toBe(
				element.getAttribute( 'aria-label' )
			);
		} );
	} );

	it( 'uses the translated labels, and its own for the missing ones', () => {
		const diagram = setup( 'zoom' );

		addControls( diagram, { controls: 'Besturing', zoomIn: 'Inzoomen' } );

		expect( toolbar( diagram ).getAttribute( 'aria-label' ) ).toBe(
			'Besturing'
		);
		expect( labels( diagram ) ).toEqual( [
			'Zoom out',
			'Inzoomen',
			'Reset zoom',
		] );
	} );

	it( 'adds the controls once', () => {
		const diagram = setup( 'zoom' );

		addControls( diagram );
		addControls( diagram );

		expect( labels( diagram ) ).toHaveLength( 3 );
	} );

	it( 'adds nothing to a diagram that did not render', () => {
		const diagram = setup( 'zoom download' );
		diagram.querySelector( '.mermaid-blocks-diagram__canvas' ).remove();

		addControls( diagram );

		expect( toolbar( diagram ) ).toBeNull();
	} );

	it( 'offers no zoom for an SVG that cannot be scaled', () => {
		const diagram = setup(
			'zoom download',
			'<svg width="800" height="400"></svg>'
		);

		addControls( diagram );

		expect( labels( diagram ) ).toEqual( [
			'Download as SVG',
			'Download as PNG',
		] );
	} );

	it( 'enables the zoom buttons that can be used', () => {
		const diagram = setup( 'zoom' );
		addControls( diagram );

		expect( isDisabled( diagram, 'Zoom out' ) ).toBe( true );
		expect( isDisabled( diagram, 'Reset zoom' ) ).toBe( true );
		expect( isDisabled( diagram, 'Zoom in' ) ).toBe( false );

		button( diagram, 'Zoom in' ).click();

		expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( true );
		expect( isDisabled( diagram, 'Zoom out' ) ).toBe( false );
		expect( isDisabled( diagram, 'Reset zoom' ) ).toBe( false );

		button( diagram, 'Reset zoom' ).click();

		expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );
		expect( isDisabled( diagram, 'Zoom out' ) ).toBe( true );
	} );

	it( 'ignores a disabled button, which stays focusable', () => {
		const diagram = setup( 'zoom' );
		addControls( diagram );
		const zoomOut = button( diagram, 'Zoom out' );

		zoomOut.click();

		expect( zoomOut.disabled ).toBe( false );
		expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );
	} );

	it.each( [
		[ 'Download as SVG', 'svg' ],
		[ 'Download as PNG', 'png' ],
	] )( '%s downloads the diagram', async ( label, format ) => {
		const diagram = setup( 'download' );
		addControls( diagram );

		button( diagram, label ).click();
		await settle();

		expect( downloadDiagram ).toHaveBeenCalledWith(
			diagram.querySelector( '.mermaid-blocks-diagram__canvas svg' ),
			format,
			expect.any( Function )
		);
	} );

	it( 'draws a Pele diagram in full for a download', async () => {
		const renderer = {
			name: 'pele',
			draw: jest.fn().mockResolvedValue( {
				svg: '<svg viewBox="0 0 1600 200"></svg>',
			} ),
		};
		const diagram = setup( 'download' );
		diagram.querySelector( 'pre' ).textContent = 'flowchart LR\nA --> B';
		diagram.querySelector(
			'.mermaid-blocks-diagram__canvas'
		).dataset.mermaidTheme = 'dark';
		addControls( diagram, undefined, renderer );

		button( diagram, 'Download as SVG' ).click();
		await settle();

		const use = jest.fn();
		await downloadDiagram.mock.calls[ 0 ][ 2 ]( use );

		expect( renderer.draw ).toHaveBeenCalledWith(
			'flowchart LR\nA --> B',
			'dark',
			expect.any( window.HTMLElement ),
			expect.any( String )
		);
		expect( use.mock.calls[ 0 ][ 0 ].getAttribute( 'viewBox' ) ).toBe(
			'0 0 1600 200'
		);
	} );

	it( 'starts one download at a time', async () => {
		const diagram = setup( 'download' );
		addControls( diagram );

		button( diagram, 'Download as PNG' ).click();
		button( diagram, 'Download as PNG' ).click();
		await settle();

		expect( downloadDiagram ).toHaveBeenCalledTimes( 1 );

		button( diagram, 'Download as PNG' ).click();

		expect( downloadDiagram ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'tells when the file could not be created', async () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		downloadDiagram.mockRejectedValue( new Error( 'Tainted canvas' ) );
		const diagram = setup( 'download' );
		addControls( diagram, { downloadError: 'No file.' } );
		const status = diagram.querySelector( '[role="status"]' );

		expect( status.textContent ).toBe( '' );

		button( diagram, 'Download as PNG' ).click();
		await settle();

		expect( status.textContent ).toBe( 'No file.' );
		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalled();

		downloadDiagram.mockResolvedValue();
		button( diagram, 'Download as PNG' ).click();

		expect( status.textContent ).toBe( '' );
	} );

	it( 'puts the controls in one order, whatever order they are asked in', () => {
		mockClipboard();
		const diagram = setup( 'fullscreen copy download zoom' );

		addControls( diagram );

		expect( labels( diagram ) ).toEqual( [
			'Zoom out',
			'Zoom in',
			'Reset zoom',
			'Download as SVG',
			'Download as PNG',
			'Copy code',
			'View fullscreen',
		] );
	} );

	describe( 'the copy button', () => {
		it( 'copies the code of the diagram, and says so for a while', async () => {
			jest.useFakeTimers();
			const clipboard = mockClipboard();
			const diagram = setup( 'copy' );
			addControls( diagram, { copied: 'Gekopieerd.' } );
			const status = diagram.querySelector( '[role="status"]' );

			expect( labels( diagram ) ).toEqual( [ 'Copy code' ] );
			expect( status.nextElementSibling ).toBe(
				button( diagram, 'Copy code' )
			);

			button( diagram, 'Copy code' ).click();
			await jest.advanceTimersByTimeAsync( 0 );

			expect( clipboard.writeText ).toHaveBeenCalledWith( 'graph LR' );
			expect( status.textContent ).toBe( 'Gekopieerd.' );

			await jest.advanceTimersByTimeAsync( 5000 );

			expect( status.textContent ).toBe( '' );
		} );

		it( 'tells when the code could not be copied', async () => {
			jest.spyOn( console, 'error' ).mockImplementation( () => {} );
			mockClipboard().writeText.mockRejectedValue(
				new Error( 'Not allowed' )
			);
			const diagram = setup( 'copy' );
			addControls( diagram );

			button( diagram, 'Copy code' ).click();
			await settle();

			expect(
				diagram.querySelector( '[role="status"]' ).textContent
			).toBe( 'The code could not be copied.' );
			// eslint-disable-next-line no-console
			expect( console.error ).toHaveBeenCalled();
		} );

		it( 'is left out where the page has no clipboard', () => {
			mockClipboard( null );
			const diagram = setup( 'copy download' );

			addControls( diagram );

			expect( labels( diagram ) ).toEqual( [
				'Download as SVG',
				'Download as PNG',
			] );

			const other = setup( 'copy' );

			addControls( other );

			expect( toolbar( other ) ).toBeNull();
		} );

		it( 'shares the place for messages with the download buttons', async () => {
			jest.spyOn( console, 'error' ).mockImplementation( () => {} );
			mockClipboard();
			downloadDiagram.mockRejectedValue( new Error( 'Tainted canvas' ) );
			const diagram = setup( 'download copy' );
			addControls( diagram );

			expect(
				diagram.querySelectorAll( '[role="status"]' )
			).toHaveLength( 1 );

			button( diagram, 'Download as PNG' ).click();
			await settle();
			button( diagram, 'Copy code' ).click();
			await settle();

			expect(
				diagram.querySelector( '[role="status"]' ).textContent
			).toBe( 'Copied.' );
		} );
	} );

	describe( 'the fullscreen button', () => {
		it( 'shows the diagram over the whole screen, and back', () => {
			const diagram = setup( 'fullscreen' );
			addControls( diagram );
			const fullscreen = button( diagram, 'View fullscreen' );

			expect( labels( diagram ) ).toEqual( [ 'View fullscreen' ] );
			expect( diagram.querySelector( '[role="status"]' ) ).toBeNull();

			fullscreen.click();

			expect( diagram.classList.contains( 'is-fullscreen' ) ).toBe(
				true
			);
			expect( fullscreen.getAttribute( 'aria-label' ) ).toBe(
				'Exit fullscreen'
			);
			expect( fullscreen.title ).toBe( 'Exit fullscreen' );

			fullscreen.click();

			expect( diagram.classList.contains( 'is-fullscreen' ) ).toBe(
				false
			);
			expect( fullscreen.getAttribute( 'aria-label' ) ).toBe(
				'View fullscreen'
			);
		} );

		it( 'gets the focus back when Escape closes the diagram', () => {
			const diagram = setup( 'fullscreen' );
			addControls( diagram );
			const fullscreen = button( diagram, 'View fullscreen' );

			fullscreen.click();
			document.body.focus();
			document.dispatchEvent(
				new window.KeyboardEvent( 'keydown', { key: 'Escape' } )
			);

			expect( diagram.classList.contains( 'is-fullscreen' ) ).toBe(
				false
			);
			expect( document.activeElement ).toBe( fullscreen );
		} );

		it( 'resets the zoom, which was relative to the old size', () => {
			const diagram = setup( 'zoom fullscreen' );
			addControls( diagram );

			button( diagram, 'Zoom in' ).click();

			expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( true );

			button( diagram, 'View fullscreen' ).click();

			expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );

			button( diagram, 'Zoom in' ).click();
			button( diagram, 'Exit fullscreen' ).click();

			expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );
		} );

		it( 'tells that a diagram drawn again is still fullscreen', () => {
			const diagram = setup( 'fullscreen' );
			addControls( diagram );

			button( diagram, 'View fullscreen' ).click();
			// As redrawDiagram() does before the controls are added again.
			toolbar( diagram ).remove();
			addControls( diagram, { exitFullscreen: 'Sluiten' } );

			expect( labels( diagram ) ).toEqual( [ 'Sluiten' ] );

			button( diagram, 'Sluiten' ).click();

			expect( diagram.classList.contains( 'is-fullscreen' ) ).toBe(
				false
			);
		} );
	} );
} );
