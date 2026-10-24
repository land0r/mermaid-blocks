import watchFonts from '../watch-fonts';

describe( 'watchFonts', () => {
	it( 'calls back each time fonts finish loading, until stopped', () => {
		const fonts = new EventTarget();
		const onLoaded = jest.fn();

		const stop = watchFonts( onLoaded, { fonts } );

		fonts.dispatchEvent( new Event( 'loadingdone' ) );
		fonts.dispatchEvent( new Event( 'loadingdone' ) );
		fonts.dispatchEvent( new Event( 'loading' ) );

		expect( onLoaded ).toHaveBeenCalledTimes( 2 );

		stop();
		fonts.dispatchEvent( new Event( 'loadingdone' ) );

		expect( onLoaded ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'does nothing where the document has no fonts, as in jsdom', () => {
		expect( document.fonts ).toBeUndefined();
		expect( () => watchFonts( jest.fn() )() ).not.toThrow();
	} );
} );
