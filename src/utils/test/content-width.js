import getContentWidth from '../content-width';

const place = ( clientWidth, padding = '0' ) => {
	const element = document.createElement( 'div' );

	element.style.padding = `0 ${ padding }`;
	Object.defineProperty( element, 'clientWidth', { value: clientWidth } );
	document.body.appendChild( element );

	return element;
};

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'getContentWidth', () => {
	it( 'is the width less the horizontal padding', () => {
		expect( getContentWidth( place( 400 ) ) ).toBe( 400 );
		expect( getContentWidth( place( 400, '16px' ) ) ).toBe( 368 );
	} );

	it( 'is 0 for an element with no width or no room', () => {
		expect( getContentWidth( place( 0 ) ) ).toBe( 0 );
		expect( getContentWidth( place( 20, '16px' ) ) ).toBe( 0 );
	} );

	it( 'is 0 for an element that is not on a page', () => {
		const element = document.createElement( 'div' );

		Object.defineProperty( element, 'clientWidth', { value: 400 } );

		expect( getContentWidth( element ) ).toBe( 0 );
	} );
} );
