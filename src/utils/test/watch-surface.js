import watchSurface from '../watch-surface';

// Lets the mutations made so far reach their observer.
const flush = () => Promise.resolve();

describe( 'watchSurface', () => {
	let onChange;
	let stop;
	let scheme;

	beforeEach( () => {
		jest.useFakeTimers();
		onChange = jest.fn();
		scheme = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		};
		window.matchMedia = jest.fn( () => scheme );
		document.body.innerHTML =
			'<main><section><div id="diagram"></div></section><aside></aside></main>';
	} );

	afterEach( () => {
		stop();
		jest.useRealTimers();
		delete window.matchMedia;
		document.body.removeAttribute( 'class' );
		document.documentElement.removeAttribute( 'data-theme' );
		document.body.innerHTML = '';
	} );

	const fade = ( propertyName, target = document.body ) => {
		const event = new window.Event( 'transitionend', { bubbles: true } );
		event.propertyName = propertyName;
		target.dispatchEvent( event );
	};

	it( 'tells when the body or the root element changes, once the page has settled', async () => {
		stop = watchSurface( onChange );

		document.body.classList.add( 'dark-mode' );
		await flush();

		expect( onChange ).not.toHaveBeenCalled();

		jest.advanceTimersByTime( 100 );

		expect( onChange ).toHaveBeenCalledTimes( 1 );

		document.documentElement.setAttribute( 'data-theme', 'dark' );
		await flush();
		jest.advanceTimersByTime( 100 );

		expect( onChange ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'tells once for a burst of changes', async () => {
		stop = watchSurface( onChange );

		document.body.classList.add( 'dark-mode' );
		await flush();
		jest.advanceTimersByTime( 60 );
		document.body.classList.add( 'is-switching' );
		await flush();
		jest.advanceTimersByTime( 60 );

		expect( onChange ).not.toHaveBeenCalled();

		jest.advanceTimersByTime( 40 );

		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'tells when the visitor’s system turns dark or light', () => {
		stop = watchSurface( onChange );

		expect( window.matchMedia ).toHaveBeenCalledWith(
			'(prefers-color-scheme: dark)'
		);

		const [ type, listener ] = scheme.addEventListener.mock.calls[ 0 ];
		listener();
		jest.advanceTimersByTime( 100 );

		expect( type ).toBe( 'change' );
		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'tells when a colour has faded, but not after other transitions', () => {
		stop = watchSurface( onChange );

		fade( 'opacity' );
		fade( 'transform', document.querySelector( 'aside' ) );
		jest.advanceTimersByTime( 100 );

		expect( onChange ).not.toHaveBeenCalled();

		fade( 'background-color' );
		jest.advanceTimersByTime( 100 );
		fade( 'color', document.querySelector( 'aside' ) );
		jest.advanceTimersByTime( 100 );

		expect( onChange ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'leaves the elements around a diagram alone unless asked', async () => {
		stop = watchSurface( onChange );

		document.querySelector( 'section' ).style.backgroundColor = '#000';
		await flush();
		jest.advanceTimersByTime( 100 );

		expect( onChange ).not.toHaveBeenCalled();
	} );

	it( 'watches the elements around the given element', async () => {
		stop = watchSurface( onChange, {
			element: document.getElementById( 'diagram' ),
		} );

		document.querySelector( 'section' ).style.backgroundColor = '#000';
		await flush();
		jest.advanceTimersByTime( 100 );

		expect( onChange ).toHaveBeenCalledTimes( 1 );

		// Not an ancestor.
		document.querySelector( 'aside' ).style.backgroundColor = '#000';
		await flush();
		jest.advanceTimersByTime( 100 );

		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'watches the given window, with its own timers', async () => {
		const frame = document.createElement( 'iframe' );
		document.body.appendChild( frame );
		const view = frame.contentWindow;
		view.matchMedia = jest.fn( () => scheme );
		view.setTimeout = jest.fn();

		stop = watchSurface( onChange, { view } );

		// The page around the frame is not the frame's page.
		document.body.classList.add( 'dark-mode' );
		await flush();

		expect( view.matchMedia ).toHaveBeenCalled();
		expect( view.setTimeout ).not.toHaveBeenCalled();

		fade( 'background-color', view.document.body );

		expect( view.setTimeout ).toHaveBeenCalledWith( onChange, 100 );
	} );

	it( 'stops telling', async () => {
		stop = watchSurface( onChange );

		document.body.classList.add( 'dark-mode' );
		await flush();
		stop();
		jest.advanceTimersByTime( 100 );

		document.body.classList.remove( 'dark-mode' );
		fade( 'background-color' );
		await flush();
		jest.advanceTimersByTime( 100 );

		expect( onChange ).not.toHaveBeenCalled();
		expect( scheme.removeEventListener ).toHaveBeenCalledWith(
			'change',
			scheme.addEventListener.mock.calls[ 0 ][ 1 ]
		);
	} );

	it( 'works without matchMedia', async () => {
		delete window.matchMedia;

		stop = watchSurface( onChange );
		document.body.classList.add( 'dark-mode' );
		await flush();
		jest.advanceTimersByTime( 100 );

		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );
} );
