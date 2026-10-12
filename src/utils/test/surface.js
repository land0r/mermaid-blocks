import { getSurface } from '../surface';

/**
 * Builds nested elements, outermost first, and gives each the computed style
 * listed for it. jsdom computes no colours from a stylesheet, and rejects the
 * newer colour notations.
 *
 * @param {...Object} styles The computed style of each element.
 *
 * @return {HTMLElement} The innermost element.
 */
function nest( ...styles ) {
	const computed = new Map();
	let parent = document.body;

	styles.forEach( ( style ) => {
		const element = document.createElement( 'div' );
		parent.appendChild( element );
		computed.set( element, style );
		parent = element;
	} );

	jest.spyOn( window, 'getComputedStyle' ).mockImplementation(
		( element ) => ( {
			backgroundColor: 'rgba(0, 0, 0, 0)',
			backgroundImage: 'none',
			color: 'rgb(0, 0, 0)',
			...computed.get( element ),
		} )
	);

	return parent;
}

describe( 'getSurface', () => {
	afterEach( () => {
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	} );

	it( 'reads a dark background behind the element', () => {
		const element = nest( { backgroundColor: 'rgb(17, 24, 39)' }, {}, {} );

		expect( getSurface( element ) ).toEqual( {
			isDark: true,
			color: 'rgb(17, 24, 39)',
		} );
	} );

	it( 'reads a light background behind the element', () => {
		const element = nest( { backgroundColor: 'rgb(249, 246, 238)' }, {} );

		expect( getSurface( element ) ).toEqual( {
			isDark: false,
			color: 'rgb(249, 246, 238)',
		} );
	} );

	it( 'takes the nearest background', () => {
		const element = nest(
			{ backgroundColor: 'rgb(0, 0, 0)' },
			{ backgroundColor: 'rgb(255, 255, 255)' },
			{}
		);

		expect( getSurface( element ).isDark ).toBe( false );
	} );

	it( 'takes the background of the element itself', () => {
		const element = nest(
			{ backgroundColor: 'rgb(255, 255, 255)' },
			{ backgroundColor: 'rgb(0, 0, 0)' }
		);

		expect( getSurface( element ).isDark ).toBe( true );
	} );

	it( 'draws the line where white text becomes easier to read than black', () => {
		expect(
			getSurface( nest( { backgroundColor: 'rgb(110, 110, 110)' } ) )
				.isDark
		).toBe( true );
		expect(
			getSurface( nest( { backgroundColor: 'rgb(128, 128, 128)' } ) )
				.isDark
		).toBe( false );
	} );

	it.each( [
		[ 'rgba(0, 0, 0, 0.2)' ],
		[ 'rgb(0 0 0 / 20%)' ],
		[ 'transparent' ],
		[ '' ],
	] )(
		'looks through a background that is mostly transparent (%p)',
		( color ) => {
			const element = nest(
				{ backgroundColor: 'rgb(255, 255, 255)' },
				{ backgroundColor: color }
			);

			expect( getSurface( element ) ).toEqual( {
				isDark: false,
				color: 'rgb(255, 255, 255)',
			} );
		}
	);

	it.each( [ [ 'rgba(0, 0, 0, 0.8)' ], [ 'rgb(0 0 0 / 80%)' ] ] )(
		'counts a background that is mostly opaque (%p)',
		( color ) => {
			const element = nest(
				{ backgroundColor: 'rgb(255, 255, 255)' },
				{ backgroundColor: color }
			);

			expect( getSurface( element ) ).toEqual( {
				isDark: true,
				color: 'rgb(0, 0, 0)',
			} );
		}
	);

	it( 'goes by the colour of the text behind a background image', () => {
		const onPhoto = nest(
			{ backgroundColor: 'rgb(255, 255, 255)' },
			{ backgroundImage: 'url("photo.jpg")' },
			{ color: 'rgb(241, 245, 249)' }
		);

		expect( getSurface( onPhoto ) ).toEqual( {
			isDark: true,
			color: null,
		} );

		const onPaper = nest(
			{ backgroundColor: 'rgb(0, 0, 0)' },
			{ backgroundImage: 'linear-gradient(white, ivory)' },
			{ color: 'rgb(30, 30, 30)' }
		);

		expect( getSurface( onPaper ) ).toEqual( {
			isDark: false,
			color: null,
		} );
	} );

	it( 'goes by the colour of the text on a page without a background', () => {
		expect( getSurface( nest( { color: 'rgb(255, 255, 255)' } ) ) ).toEqual(
			{ isDark: true, color: null }
		);
		expect( getSurface( nest( {} ) ) ).toEqual( {
			isDark: false,
			color: null,
		} );
	} );

	it( 'does not take grey text on a light page for light text', () => {
		const element = nest( { color: 'rgb(153, 153, 153)' } );

		expect( getSurface( element ).isDark ).toBe( false );
	} );

	it( 'reads a colour in a newer notation by drawing it', () => {
		const context = {
			fillRect: jest.fn(),
			getImageData: jest.fn( () => ( { data: [ 20, 22, 30, 255 ] } ) ),
		};
		jest.spyOn(
			window.HTMLCanvasElement.prototype,
			'getContext'
		).mockImplementation( () => context );

		const element = nest( { backgroundColor: 'oklch(0.2 0.02 270)' }, {} );

		expect( getSurface( element ) ).toEqual( {
			isDark: true,
			color: 'rgb(20, 22, 30)',
		} );
		expect( context.fillStyle ).toBe( 'oklch(0.2 0.02 270)' );
	} );

	it( 'passes over a colour it cannot read', () => {
		jest.spyOn(
			window.HTMLCanvasElement.prototype,
			'getContext'
		).mockImplementation( () => null );

		const element = nest(
			{ backgroundColor: 'rgb(0, 0, 0)' },
			{ backgroundColor: 'oklch(0.9 0.02 270)' }
		);

		expect( getSurface( element ) ).toEqual( {
			isDark: true,
			color: 'rgb(0, 0, 0)',
		} );
	} );
} );
