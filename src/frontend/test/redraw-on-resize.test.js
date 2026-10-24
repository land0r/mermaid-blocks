// eslint-disable-next-line import/no-unresolved
import * as pele from 'pele/lazy';

import renderDiagrams from '../render-diagrams';
import redrawOnResize from '../redraw-on-resize';
import { createMermaidRenderer } from '../../renderers/mermaid';
import { createPeleRenderer } from '../../renderers/pele';

const measurer = { width: ( text, size ) => text.length * size * 0.55 };

// Nine boxes in a row: wider than a phone, and laid out vertically for one.
const CODE =
	'flowchart LR\n' +
	Array.from( { length: 9 }, ( _, i ) => `N${ i } --> N${ i + 1 }` ).join(
		'\n'
	);

let width;
let observers;
let frames;
let diagram;
let canvas;

class FakeResizeObserver {
	constructor( callback ) {
		this.callback = callback;
		this.observe = jest.fn();
		this.disconnect = jest.fn();
		observers.push( this );
	}
}

// Gives an element the width the test sets, as jsdom lays nothing out.
const sized = ( element ) =>
	Object.defineProperty( element, 'clientWidth', {
		get: () => width,
		configurable: true,
	} );

const getViewBox = () =>
	canvas
		.querySelector( 'svg' )
		.getAttribute( 'viewBox' )
		.split( ' ' )
		.map( Number );

// The window is resized: the observer tells, and the frame runs.
const resize = async ( to ) => {
	width = to;
	observers.forEach( ( observer ) => observer.callback( [] ) );
	frames.splice( 0 ).forEach( ( callback ) => callback() );

	// The drawing is asynchronous.
	await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
};

/**
 * Renders a diagram on a page that is `start` pixels wide, and starts watching
 * it.
 *
 * @param {Object} renderer The renderer.
 * @param {number} start    The width.
 */
async function setup( renderer, start = 1280 ) {
	width = start;
	observers = [];
	frames = [];
	window.ResizeObserver = FakeResizeObserver;
	jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation(
		( callback ) => frames.push( callback )
	);

	document.body.innerHTML =
		'<div class="mermaid-blocks-diagram">' +
		`<pre class="mermaid-blocks-diagram__source">${ CODE }</pre></div>`;
	diagram = document.querySelector( '.mermaid-blocks-diagram' );
	sized( diagram );

	await renderDiagrams( renderer, diagram );

	canvas = diagram.querySelector( '.mermaid-blocks-diagram__canvas' );
	sized( canvas );
	redrawOnResize( renderer, diagram );
}

afterEach( () => {
	delete window.ResizeObserver;
	document.body.innerHTML = '';
	jest.restoreAllMocks();
} );

describe( 'redrawOnResize', () => {
	const renderer = createPeleRenderer( pele, { measurer } );

	it( 'lays a wide diagram out vertically on a narrow screen, and horizontally again on a wide one', async () => {
		await setup( renderer );

		const [ , , wideWidth, wideHeight ] = getViewBox();

		expect( wideWidth ).toBeGreaterThan( wideHeight );

		await resize( 375 );

		const [ , , narrowWidth, narrowHeight ] = getViewBox();

		expect( narrowHeight ).toBeGreaterThan( narrowWidth );

		await resize( 1280 );

		expect( getViewBox() ).toEqual( [ 0, 0, wideWidth, wideHeight ] );
	} );

	it( 'draws again once for a width, with the canvas, the palette and the toolbar kept', async () => {
		const draw = jest.spyOn( renderer, 'draw' );

		await setup( renderer );
		const toolbar = document.createElement( 'div' );
		toolbar.className = 'mermaid-blocks-diagram__toolbar';
		diagram.insertBefore( toolbar, canvas );
		const svg = canvas.querySelector( 'svg' );
		const palette = canvas.style.getPropertyValue( '--pele-fg' );

		draw.mockClear();

		await resize( 375 );
		await resize( 375 );

		expect( draw ).toHaveBeenCalledTimes( 1 );
		expect( draw.mock.calls[ 0 ][ 2 ] ).toBe( diagram );
		expect( canvas.querySelector( 'svg' ) ).toBe( svg );
		expect(
			diagram.querySelector( '.mermaid-blocks-diagram__toolbar' )
		).toBe( toolbar );
		expect( canvas.style.getPropertyValue( '--pele-fg' ) ).toBe( palette );
	} );

	it( 'draws again at most once per frame', async () => {
		const draw = jest.spyOn( renderer, 'draw' );

		await setup( renderer );
		draw.mockClear();

		width = 600;
		observers[ 0 ].callback( [] );
		width = 500;
		observers[ 0 ].callback( [] );
		width = 375;
		observers[ 0 ].callback( [] );

		expect( frames ).toHaveLength( 1 );

		frames.splice( 0 ).forEach( ( callback ) => callback() );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		expect( draw ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not draw again for the width it was drawn for', async () => {
		const draw = jest.spyOn( renderer, 'draw' );

		await setup( renderer );
		draw.mockClear();

		await resize( 1280 );

		expect( draw ).not.toHaveBeenCalled();
	} );

	it( 'lays the diagram out for its own width, when the canvas keeps another', async () => {
		await setup( renderer );

		// A theme that pads the diagram: the canvas inside stays as it was.
		Object.defineProperty( canvas, 'clientWidth', { value: 1280 } );

		await resize( 375 );

		const [ , , narrowWidth, narrowHeight ] = getViewBox();

		expect( narrowHeight ).toBeGreaterThan( narrowWidth );
	} );

	it( 'watches a diagram once', async () => {
		await setup( renderer );
		redrawOnResize( renderer, diagram );

		expect( observers ).toHaveLength( 1 );
		expect( observers[ 0 ].observe ).toHaveBeenCalledWith( diagram );
	} );

	it( 'never watches a Mermaid.js diagram', async () => {
		const mermaid = {
			render: async () => ( { svg: '<svg viewBox="0 0 10 10"></svg>' } ),
		};

		await setup( createMermaidRenderer( mermaid ) );

		expect( observers ).toHaveLength( 0 );
	} );
} );
