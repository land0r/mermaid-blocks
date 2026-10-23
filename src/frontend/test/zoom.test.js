import createZoom from '../zoom';

// The diagram fits the page at 400 by 200 pixels, in a canvas of that size.
const FITTED_WIDTH = 400;

/**
 * Builds a rendered diagram. jsdom lays nothing out, so the SVG reports the
 * size its inline width gives it, at the position the canvas is scrolled to.
 *
 * @param {string} [svgStyle] The inline style of the SVG.
 */
function setup( svgStyle = 'max-width: 800px;' ) {
	document.body.innerHTML =
		'<div class="mermaid-blocks-diagram is-rendered">' +
		'<div class="mermaid-blocks-diagram__canvas">' +
		'<svg width="100%" viewBox="0 0 800 400" style="' +
		svgStyle +
		'"><a href="#node"><rect></rect></a></svg>' +
		'</div></div>';

	const diagram = document.body.firstElementChild;
	const canvas = diagram.firstElementChild;
	const svg = canvas.firstElementChild;
	const size = { hidden: false };

	canvas.getBoundingClientRect = () => ( {
		left: 0,
		top: 0,
		width: FITTED_WIDTH,
		height: FITTED_WIDTH / 2,
	} );
	svg.getBoundingClientRect = () => {
		const width = size.hidden
			? 0
			: parseFloat( svg.style.width ) || FITTED_WIDTH;

		return {
			left: -canvas.scrollLeft,
			top: -canvas.scrollTop,
			width,
			height: width / 2,
		};
	};
	canvas.setPointerCapture = jest.fn();

	const onChange = jest.fn();
	const zoom = createZoom( diagram, canvas, svg, onChange );

	return { diagram, canvas, svg, size, zoom, onChange };
}

function wheel( target, init ) {
	const event = new window.WheelEvent( 'wheel', {
		bubbles: true,
		cancelable: true,
		...init,
	} );

	target.dispatchEvent( event );

	return event;
}

// jsdom has no PointerEvent.
function pointer( target, type, init = {} ) {
	const event = new window.MouseEvent( type, {
		bubbles: true,
		cancelable: true,
		button: 0,
		buttons: type === 'pointerup' ? 0 : 1,
		...init,
	} );

	Object.assign( event, { pointerId: 1, pointerType: 'mouse' }, init.extra );
	target.dispatchEvent( event );

	return event;
}

function click( target ) {
	const event = new window.MouseEvent( 'click', {
		bubbles: true,
		cancelable: true,
	} );
	const onClick = jest.fn();

	target.addEventListener( 'click', onClick );
	target.dispatchEvent( event );
	target.removeEventListener( 'click', onClick );

	return onClick.mock.calls.length > 0;
}

describe( 'createZoom', () => {
	it( 'zooms in by widening the SVG past its canvas', () => {
		const { diagram, canvas, svg, zoom, onChange } = setup();

		zoom.zoomIn();

		expect( svg.style.width ).toBe( '600px' );
		expect( svg.style.maxWidth ).toBe( 'none' );
		expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( true );
		expect( canvas.tabIndex ).toBe( 0 );
		expect( onChange ).toHaveBeenLastCalledWith( {
			canZoomIn: true,
			canZoomOut: true,
		} );
	} );

	it( 'zooms past the max-width Pele draws its SVG with, and restores it', () => {
		const { svg, zoom } = setup( 'max-width:100%;height:auto' );

		zoom.zoomIn();

		expect( svg.style.width ).toBe( '600px' );
		expect( svg.style.maxWidth ).toBe( 'none' );

		zoom.zoomOut();

		expect( svg.style.width ).toBe( '' );
		expect( svg.style.maxWidth ).toBe( '100%' );
	} );

	it( 'keeps the centre of the view in place', () => {
		const { canvas, zoom } = setup();

		zoom.zoomIn();

		// The middle of a 600 by 300 diagram, in a 400 by 200 view.
		expect( canvas.scrollLeft ).toBe( 100 );
		expect( canvas.scrollTop ).toBe( 50 );
	} );

	it( 'returns the SVG to its own size when zoomed back out', () => {
		const { diagram, canvas, svg, zoom, onChange } = setup();

		zoom.zoomIn();
		zoom.zoomOut();

		expect( svg.style.width ).toBe( '' );
		expect( svg.style.maxWidth ).toBe( '800px' );
		expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );
		expect( canvas.hasAttribute( 'tabindex' ) ).toBe( false );
		expect( onChange ).toHaveBeenLastCalledWith( {
			canZoomIn: true,
			canZoomOut: false,
		} );
	} );

	it( 'resets from any level', () => {
		const { diagram, svg, zoom } = setup();

		zoom.zoomIn();
		zoom.zoomIn();
		zoom.reset();

		expect( svg.style.maxWidth ).toBe( '800px' );
		expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );
	} );

	it( 'stops at the largest and at the smallest level', () => {
		const { svg, zoom, onChange } = setup();

		for ( let i = 0; i < 10; i++ ) {
			zoom.zoomIn();
		}

		expect( parseFloat( svg.style.width ) ).toBeCloseTo(
			FITTED_WIDTH * 1.5 ** 5
		);
		expect( onChange ).toHaveBeenCalledTimes( 5 );
		expect( onChange ).toHaveBeenLastCalledWith( {
			canZoomIn: false,
			canZoomOut: true,
		} );

		for ( let i = 0; i < 10; i++ ) {
			zoom.zoomOut();
		}

		expect( svg.style.width ).toBe( '' );
		expect( onChange ).toHaveBeenCalledTimes( 10 );
	} );

	it( 'leaves a hidden diagram alone', () => {
		const { diagram, size, zoom, onChange } = setup();
		size.hidden = true;

		zoom.zoomIn();

		expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );
		expect( onChange ).not.toHaveBeenCalled();
	} );

	describe( 'wheel', () => {
		it( 'scrolls the page as usual without Ctrl or Cmd', () => {
			const { canvas, diagram } = setup();

			const event = wheel( canvas, { deltaY: -100 } );

			expect( event.defaultPrevented ).toBe( false );
			expect( diagram.classList.contains( 'is-zoomed' ) ).toBe( false );
		} );

		it.each( [ 'ctrlKey', 'metaKey' ] )(
			'zooms with %s, around the pointer',
			( key ) => {
				const { canvas, svg } = setup();

				const event = wheel( canvas, {
					deltaY: -100,
					[ key ]: true,
					clientX: 400,
					clientY: 200,
				} );

				// One notch of a mouse wheel: the limit of 50, so √2.
				const width = FITTED_WIDTH * Math.SQRT2;
				expect( event.defaultPrevented ).toBe( true );
				expect( parseFloat( svg.style.width ) ).toBeCloseTo( width );
				// The bottom right corner stays under the pointer.
				expect( canvas.scrollLeft ).toBeCloseTo( width - 400 );
				expect( canvas.scrollTop ).toBeCloseTo( width / 2 - 200 );
			}
		);

		it( 'zooms a little for the small steps of a pinch', () => {
			const { canvas, svg } = setup();

			wheel( canvas, { deltaY: -4, ctrlKey: true } );

			expect( parseFloat( svg.style.width ) ).toBeCloseTo(
				FITTED_WIDTH * 2 ** 0.04
			);
		} );

		it( 'counts a wheel that reports lines', () => {
			const { canvas, svg } = setup();

			wheel( canvas, { deltaY: -1, deltaMode: 1, ctrlKey: true } );

			expect( parseFloat( svg.style.width ) ).toBeCloseTo(
				FITTED_WIDTH * 2 ** 0.16
			);
		} );

		it( 'leaves the page zoom to the browser at the end of the range', () => {
			const { canvas } = setup();

			const event = wheel( canvas, { deltaY: 100, ctrlKey: true } );

			expect( event.defaultPrevented ).toBe( false );
		} );

		it( 'lets the buttons continue from a level between two steps', () => {
			const { canvas, svg, zoom } = setup();

			wheel( canvas, { deltaY: -20, ctrlKey: true } );
			zoom.zoomIn();

			expect( parseFloat( svg.style.width ) ).toBeCloseTo( 600 );

			wheel( canvas, { deltaY: 10, ctrlKey: true } );
			zoom.zoomOut();

			expect( svg.style.width ).toBe( '' );
		} );
	} );

	describe( 'dragging with a mouse', () => {
		it( 'pans a zoomed diagram', () => {
			const { diagram, canvas, svg, zoom } = setup();
			zoom.zoomIn();
			zoom.zoomIn();
			canvas.scrollLeft = 200;
			canvas.scrollTop = 100;

			pointer( svg, 'pointerdown', { clientX: 300, clientY: 150 } );
			pointer( svg, 'pointermove', { clientX: 250, clientY: 170 } );

			expect( canvas.scrollLeft ).toBe( 250 );
			expect( canvas.scrollTop ).toBe( 80 );
			expect( canvas.setPointerCapture ).toHaveBeenCalledWith( 1 );
			expect( diagram.classList.contains( 'is-panning' ) ).toBe( true );

			pointer( canvas, 'pointerup' );

			expect( diagram.classList.contains( 'is-panning' ) ).toBe( false );
		} );

		it( 'does not count the end of a drag as a click on the diagram', () => {
			const { svg, canvas, zoom } = setup();
			const link = svg.querySelector( 'a' );
			zoom.zoomIn();

			pointer( link, 'pointerdown', { clientX: 300, clientY: 150 } );
			pointer( link, 'pointermove', { clientX: 250, clientY: 150 } );
			pointer( canvas, 'pointerup' );

			expect( click( link ) ).toBe( false );
		} );

		it( 'lets a click on the diagram through', async () => {
			const { svg, zoom } = setup();
			const link = svg.querySelector( 'a' );
			zoom.zoomIn();

			pointer( link, 'pointerdown', { clientX: 300, clientY: 150 } );
			pointer( link, 'pointermove', { clientX: 301, clientY: 151 } );
			pointer( link, 'pointerup' );

			expect( click( link ) ).toBe( true );
		} );

		it( 'lets clicks through again after a drag', async () => {
			const { svg, canvas, zoom } = setup();
			const link = svg.querySelector( 'a' );
			zoom.zoomIn();

			pointer( link, 'pointerdown', { clientX: 300, clientY: 150 } );
			pointer( link, 'pointermove', { clientX: 250, clientY: 150 } );
			pointer( canvas, 'pointerup' );
			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

			expect( click( link ) ).toBe( true );
		} );

		it( 'stops when the button was released outside the canvas', () => {
			const { svg, canvas, zoom } = setup();
			zoom.zoomIn();
			canvas.scrollLeft = 100;

			pointer( svg, 'pointerdown', { clientX: 300, clientY: 150 } );
			pointer( svg, 'pointermove', {
				clientX: 200,
				clientY: 150,
				buttons: 0,
			} );

			expect( canvas.scrollLeft ).toBe( 100 );
		} );

		it( 'leaves touch to the browser', () => {
			const { svg, canvas, zoom } = setup();
			const touch = { extra: { pointerType: 'touch' } };
			zoom.zoomIn();
			canvas.scrollLeft = 100;

			pointer( svg, 'pointerdown', {
				clientX: 300,
				clientY: 150,
				...touch,
			} );
			pointer( svg, 'pointermove', {
				clientX: 200,
				clientY: 150,
				...touch,
			} );

			expect( canvas.scrollLeft ).toBe( 100 );
		} );

		it( 'does nothing while the diagram fits the page', () => {
			const { svg, canvas, diagram } = setup();

			pointer( svg, 'pointerdown', { clientX: 300, clientY: 150 } );
			pointer( svg, 'pointermove', { clientX: 200, clientY: 150 } );

			expect( canvas.scrollLeft ).toBe( 0 );
			expect( diagram.classList.contains( 'is-panning' ) ).toBe( false );
		} );
	} );
} );
