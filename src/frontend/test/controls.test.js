import addControls from '../controls';
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

describe( 'addControls', () => {
	beforeEach( () => {
		downloadDiagram.mockReset();
		downloadDiagram.mockResolvedValue();
	} );

	afterEach( () => jest.restoreAllMocks() );

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
			format
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
} );
