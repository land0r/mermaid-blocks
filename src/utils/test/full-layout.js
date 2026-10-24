// eslint-disable-next-line import/no-unresolved
import * as pele from 'pele/lazy';

import { createFullLayout, withFullLayout } from '../full-layout';
import { getSvgMarkup } from '../export-diagram';
import { setAccessibleText } from '../accessible-text';
import { createMermaidRenderer } from '../../renderers/mermaid';
import { createPeleRenderer } from '../../renderers/pele';

const measurer = { width: ( text, size ) => text.length * size * 0.55 };

const CODE =
	'flowchart LR\n' +
	Array.from( { length: 9 }, ( _, i ) => `N${ i } --> N${ i + 1 }` ).join(
		'\n'
	);

const getViewBox = ( svg ) =>
	svg.getAttribute( 'viewBox' ).split( ' ' ).map( Number );

/**
 * Draws a diagram on a page 375 pixels wide, as the front end does.
 *
 * @param {Object} renderer The renderer.
 */
async function setup( renderer ) {
	document.body.innerHTML =
		'<div class="diagram"><div class="canvas" style="font-family: Georgia, serif; --pele-fg: #123456"></div></div>';

	const diagram = document.querySelector( '.diagram' );
	const canvas = document.querySelector( '.canvas' );

	Object.defineProperty( diagram, 'clientWidth', { value: 375 } );

	const { svg } = await renderer.draw( CODE, 'auto-light', diagram, 'one' );

	canvas.innerHTML = svg;

	return { canvas, svg: canvas.querySelector( 'svg' ) };
}

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'withFullLayout', () => {
	const renderer = createPeleRenderer( pele, { measurer } );

	it( 'hands on a Pele diagram in its full layout, which the page does not have', async () => {
		const { svg } = await setup( renderer );
		const [ , , pageWidth, pageHeight ] = getViewBox( svg );
		let full;

		await withFullLayout( renderer, svg, CODE, 'auto-light', ( made ) => {
			full = made;
		} );

		const [ , , fullWidth, fullHeight ] = getViewBox( full );

		expect( pageHeight ).toBeGreaterThan( pageWidth );
		expect( fullWidth ).toBeGreaterThan( fullHeight );
		expect( full ).not.toBe( svg );
		expect( full.id ).toBe( 'one-full' );
	} );

	it( 'draws it for a hidden element in the canvas, which has its fonts and variables', async () => {
		const { canvas, svg } = await setup( renderer );
		const draw = jest.spyOn( renderer, 'draw' );
		let probe;
		let inCanvas;
		let markup;

		await withFullLayout( renderer, svg, CODE, 'auto-light', ( made ) => {
			probe = made.parentElement;
			inCanvas = probe.parentElement === canvas;
			markup = getSvgMarkup( made );
		} );

		expect( inCanvas ).toBe( true );
		expect( probe.hidden ).toBe( true );
		expect( markup ).toContain( '#123456' );
		expect( markup ).not.toContain( 'var(' );
		expect( draw.mock.calls[ 0 ][ 2 ] ).toBe( probe );
		expect( canvas.querySelectorAll( 'svg' ) ).toHaveLength( 1 );
		expect( canvas.contains( probe ) ).toBe( false );

		draw.mockRestore();
	} );

	it( 'keeps the accessible title and description of the diagram on the page', async () => {
		const { svg } = await setup( renderer );
		let title;
		let description;

		setAccessibleText( svg, {
			title: 'Order flow',
			description: 'Nine steps, one after the other.',
		} );

		await withFullLayout( renderer, svg, CODE, 'auto-light', ( made ) => {
			title = made.querySelector( ':scope > title' );
			description = made.querySelector( ':scope > desc' );
		} );

		expect( title.textContent ).toBe( 'Order flow' );
		expect( description.textContent ).toBe(
			'Nine steps, one after the other.'
		);
	} );

	it( 'removes the drawing when the file failed, and passes the failure on', async () => {
		const { canvas, svg } = await setup( renderer );

		await expect(
			withFullLayout( renderer, svg, CODE, 'auto-light', () => {
				throw new Error( 'no file' );
			} )
		).rejects.toThrow( 'no file' );

		expect( canvas.children ).toHaveLength( 1 );
	} );

	it( 'uses the diagram on the page when the full drawing fails', async () => {
		const { svg } = await setup( renderer );
		const use = jest.fn();

		await withFullLayout(
			renderer,
			svg,
			'not a diagram',
			'auto-light',
			use
		);

		expect( use ).toHaveBeenCalledWith( svg );
	} );

	it( 'uses the diagram on the page for Mermaid.js, and does not draw', async () => {
		const mermaid = { render: jest.fn() };
		const mermaidRenderer = createMermaidRenderer( mermaid );
		const { svg } = await setup( renderer );
		const use = jest.fn().mockReturnValue( 'file' );

		await expect(
			withFullLayout( mermaidRenderer, svg, CODE, 'default', use )
		).resolves.toBe( 'file' );

		expect( use ).toHaveBeenCalledWith( svg );
		expect( mermaid.render ).not.toHaveBeenCalled();
	} );

	it( 'is made by createFullLayout() from the code and the theme as they are then', async () => {
		const { svg } = await setup( renderer );
		const draw = jest.spyOn( renderer, 'draw' );
		let code = CODE;
		const full = createFullLayout(
			renderer,
			svg,
			() => code,
			() => 'dark'
		);

		code = 'flowchart LR\nA --> B';
		await full( () => {} );

		expect( draw ).toHaveBeenCalledWith(
			code,
			'dark',
			expect.any( window.HTMLElement ),
			'one-full'
		);

		draw.mockRestore();
	} );
} );
