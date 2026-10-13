import createFullscreen from '../fullscreen';

/**
 * Builds a rendered diagram.
 */
function setup() {
	document.body.innerHTML =
		'<div class="mermaid-blocks-diagram is-rendered">' +
		'<div class="mermaid-blocks-diagram__canvas"><svg></svg></div>' +
		'</div>';

	return document.body.firstElementChild;
}

/**
 * Makes the document one of a browser that shows elements fullscreen.
 *
 * @param {HTMLElement} diagram          The diagram element.
 * @param {Object}      [options]
 * @param {boolean}     [options.refuse] Whether the browser refuses.
 */
function allowFullscreen( diagram, { refuse = false } = {} ) {
	Object.defineProperty( document, 'fullscreenEnabled', {
		configurable: true,
		value: true,
	} );
	Object.defineProperty( document, 'fullscreenElement', {
		configurable: true,
		writable: true,
		value: null,
	} );

	diagram.requestFullscreen = jest.fn( () => {
		if ( refuse ) {
			return Promise.reject( new Error( 'Not allowed' ) );
		}

		document.fullscreenElement = diagram;

		return Promise.resolve();
	} );
	document.exitFullscreen = jest.fn( () => {
		document.fullscreenElement = null;

		return Promise.resolve();
	} );
}

const press = ( key ) => {
	const event = new window.KeyboardEvent( 'keydown', {
		key,
		bubbles: true,
		cancelable: true,
	} );

	document.dispatchEvent( event );

	return event;
};

// Lets a request for fullscreen be answered.
const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

const classes = ( diagram ) =>
	Array.from( diagram.classList ).filter( ( name ) =>
		name.startsWith( 'is-fullscreen' )
	);

describe( 'createFullscreen', () => {
	afterEach( () => {
		delete document.fullscreenEnabled;
		delete document.fullscreenElement;
		delete document.exitFullscreen;
		document.documentElement.style.overflow = '';
		document.body.removeAttribute( 'style' );
	} );

	describe( 'where the browser shows no element fullscreen', () => {
		it( 'covers the page with the diagram', () => {
			const diagram = setup();
			const onChange = jest.fn();
			const fullscreen = createFullscreen( diagram, onChange );

			expect( fullscreen.isActive() ).toBe( false );

			fullscreen.toggle();

			expect( fullscreen.isActive() ).toBe( true );
			expect( classes( diagram ) ).toEqual( [
				'is-fullscreen',
				'is-fullscreen-overlay',
			] );
			expect( onChange ).toHaveBeenLastCalledWith( true );
		} );

		it( 'stops the page behind it from scrolling, and lets it again', () => {
			document.documentElement.style.overflow = 'scroll';
			const fullscreen = createFullscreen( setup() );

			fullscreen.toggle();

			expect( document.documentElement.style.overflow ).toBe( 'hidden' );

			fullscreen.toggle();

			expect( document.documentElement.style.overflow ).toBe( 'scroll' );
		} );

		it( 'goes back on a second use', () => {
			const diagram = setup();
			const onChange = jest.fn();
			const fullscreen = createFullscreen( diagram, onChange );

			fullscreen.toggle();
			fullscreen.toggle();

			expect( fullscreen.isActive() ).toBe( false );
			expect( classes( diagram ) ).toEqual( [] );
			expect( onChange ).toHaveBeenLastCalledWith( false );
		} );

		it( 'goes back on Escape, and on no other key', () => {
			const diagram = setup();
			const fullscreen = createFullscreen( diagram );

			fullscreen.toggle();

			expect( press( 'Enter' ).defaultPrevented ).toBe( false );
			expect( fullscreen.isActive() ).toBe( true );

			expect( press( 'Escape' ).defaultPrevented ).toBe( true );
			expect( fullscreen.isActive() ).toBe( false );
			expect( classes( diagram ) ).toEqual( [] );
		} );

		it( 'leaves Escape alone when the diagram is not fullscreen', () => {
			const onChange = jest.fn();
			const fullscreen = createFullscreen( setup(), onChange );

			expect( press( 'Escape' ).defaultPrevented ).toBe( false );

			fullscreen.toggle();
			fullscreen.toggle();

			expect( press( 'Escape' ).defaultPrevented ).toBe( false );
			expect( onChange ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	describe( 'where the browser shows elements fullscreen', () => {
		it( 'asks the browser, and leaves the page alone', async () => {
			const diagram = setup();
			allowFullscreen( diagram );
			const fullscreen = createFullscreen( diagram );

			fullscreen.toggle();
			await settle();

			expect( diagram.requestFullscreen ).toHaveBeenCalledTimes( 1 );
			expect( classes( diagram ) ).toEqual( [ 'is-fullscreen' ] );
			expect( document.documentElement.style.overflow ).toBe( '' );
		} );

		it( 'leaves fullscreen on a second use', async () => {
			const diagram = setup();
			allowFullscreen( diagram );
			const fullscreen = createFullscreen( diagram );

			fullscreen.toggle();
			await settle();
			fullscreen.toggle();
			await settle();

			expect( document.exitFullscreen ).toHaveBeenCalledTimes( 1 );
			expect( fullscreen.isActive() ).toBe( false );
			expect( classes( diagram ) ).toEqual( [] );
		} );

		it( 'follows the browser out of fullscreen', async () => {
			const diagram = setup();
			allowFullscreen( diagram );
			const onChange = jest.fn();
			const fullscreen = createFullscreen( diagram, onChange );

			fullscreen.toggle();
			await settle();
			document.dispatchEvent( new window.Event( 'fullscreenchange' ) );

			// That was the diagram going fullscreen.
			expect( fullscreen.isActive() ).toBe( true );

			document.fullscreenElement = null;
			document.dispatchEvent( new window.Event( 'fullscreenchange' ) );

			expect( fullscreen.isActive() ).toBe( false );
			expect( classes( diagram ) ).toEqual( [] );
			expect( onChange ).toHaveBeenLastCalledWith( false );
			expect( document.exitFullscreen ).not.toHaveBeenCalled();
		} );

		it( 'covers the page itself when the browser refuses', async () => {
			const diagram = setup();
			allowFullscreen( diagram, { refuse: true } );
			const fullscreen = createFullscreen( diagram );

			fullscreen.toggle();
			await settle();

			expect( fullscreen.isActive() ).toBe( true );
			expect( classes( diagram ) ).toEqual( [
				'is-fullscreen',
				'is-fullscreen-overlay',
			] );
			expect( document.documentElement.style.overflow ).toBe( 'hidden' );

			fullscreen.toggle();

			expect( document.exitFullscreen ).not.toHaveBeenCalled();
			expect( document.documentElement.style.overflow ).toBe( '' );
		} );
	} );

	it.each( [
		[ 'the colour of a light page', 'rgb(250, 250, 240)', '', '' ],
		[ 'the colour of a dark page', 'rgb(20, 20, 30)', '', '' ],
		[ 'white where the page tells no colour', '', '', '#fff' ],
		[
			'a dark colour where only light text tells the page is dark',
			'',
			'rgb(240, 240, 240)',
			'#1e1e1e',
		],
	] )(
		'gives the diagram %s as its background',
		( name, background, color, expected ) => {
			document.body.style.backgroundColor = background;
			const diagram = setup();
			// jsdom computes no inherited colour.
			diagram.style.color = color;
			const fullscreen = createFullscreen( diagram );

			fullscreen.toggle();

			expect(
				diagram.style.getPropertyValue( '--mermaid-blocks-surface' )
			).toBe( expected || background );

			fullscreen.toggle();

			expect(
				diagram.style.getPropertyValue( '--mermaid-blocks-surface' )
			).toBe( '' );
		}
	);

	it( 'keeps the state of a diagram that gets new controls', () => {
		const diagram = setup();
		const first = jest.fn();
		const second = jest.fn();

		createFullscreen( diagram, first ).toggle();

		const fullscreen = createFullscreen( diagram, second );

		expect( fullscreen.isActive() ).toBe( true );

		press( 'Escape' );

		expect( first ).toHaveBeenCalledTimes( 1 );
		expect( second ).toHaveBeenCalledTimes( 1 );
		expect( second ).toHaveBeenCalledWith( false );
	} );

	it( 'keeps the diagrams of a page apart', () => {
		const first = setup();
		const second = first.cloneNode( true );
		document.body.append( second );

		createFullscreen( first ).toggle();
		const fullscreen = createFullscreen( second );

		expect( fullscreen.isActive() ).toBe( false );
		expect( classes( second ) ).toEqual( [] );
	} );
} );
