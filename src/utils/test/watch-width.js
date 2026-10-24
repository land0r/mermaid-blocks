import watchWidth from '../watch-width';

let observers;
let frames;
let element;
let width;

class FakeResizeObserver {
	constructor( callback ) {
		this.callback = callback;
		this.disconnect = jest.fn();
		this.observe = jest.fn();
		observers.push( this );
	}
}

// Tells the observer that the element was resized.
const resize = ( to ) => {
	if ( to !== undefined ) {
		width = to;
	}

	observers.forEach( ( observer ) => observer.callback( [] ) );
};

// Runs the animation frames that were asked for.
const runFrames = () => {
	const run = frames.splice( 0 );

	run.forEach( ( callback ) => callback && callback() );
};

const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

beforeEach( () => {
	observers = [];
	frames = [];
	width = 600;
	window.ResizeObserver = FakeResizeObserver;
	jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation(
		( callback ) => frames.push( callback )
	);
	jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( ( id ) => {
		frames[ id - 1 ] = null;
	} );

	element = document.createElement( 'div' );
	Object.defineProperty( element, 'clientWidth', { get: () => width } );
	document.body.appendChild( element );
} );

afterEach( () => {
	delete window.ResizeObserver;
	document.body.innerHTML = '';
	jest.restoreAllMocks();
} );

describe( 'watchWidth', () => {
	it( 'calls back once per frame, when the width is not the one it knew', () => {
		const onChange = jest.fn();

		watchWidth( element, onChange );

		resize( 400 );
		resize( 380 );
		expect( onChange ).not.toHaveBeenCalled();

		runFrames();
		expect( onChange ).toHaveBeenCalledTimes( 1 );

		resize( 380 );
		runFrames();
		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not call back for the width it started with, as when it first observes', () => {
		const onChange = jest.fn();

		watchWidth( element, onChange );
		resize();
		runFrames();

		expect( onChange ).not.toHaveBeenCalled();
	} );

	it( 'does not call back for a change of height only', () => {
		const onChange = jest.fn();

		watchWidth( element, onChange );
		Object.defineProperty( element, 'clientHeight', { value: 900 } );
		resize();
		runFrames();

		expect( onChange ).not.toHaveBeenCalled();
	} );

	it( 'tries again at the next resize when nothing was drawn', async () => {
		const onChange = jest.fn().mockResolvedValueOnce( false );

		watchWidth( element, onChange );

		resize( 400 );
		runFrames();
		await settle();
		resize();
		runFrames();

		expect( onChange ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'stops watching', () => {
		const onChange = jest.fn();
		const stop = watchWidth( element, onChange );

		resize( 400 );
		stop();
		runFrames();

		expect( observers[ 0 ].disconnect ).toHaveBeenCalled();
		expect( onChange ).not.toHaveBeenCalled();
	} );

	it( 'uses the observer of the window the element is in', () => {
		const frame = document.createElement( 'iframe' );
		document.body.appendChild( frame );
		const inner = frame.contentDocument.createElement( 'div' );
		frame.contentDocument.body.appendChild( inner );
		const own = jest.fn( function () {
			this.observe = jest.fn();
		} );
		frame.contentWindow.ResizeObserver = own;

		watchWidth( inner, jest.fn() );

		expect( own ).toHaveBeenCalledTimes( 1 );
		expect( observers ).toEqual( [] );
	} );

	it( 'does nothing where there is no ResizeObserver, as in jsdom', () => {
		delete window.ResizeObserver;

		expect( () => watchWidth( element, jest.fn() )() ).not.toThrow();
	} );
} );
