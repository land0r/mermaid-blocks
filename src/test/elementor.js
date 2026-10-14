import watchWidgets, { READY_HOOK, renderWidget } from '../elementor';

/**
 * Stands in for Elementor's front end: its hooks, and the jQuery event that
 * says it started.
 *
 * @param {boolean} started Whether the front end has started already.
 *
 * @return {Object} The window, and a way to start the front end.
 */
function fakeElementor( started ) {
	const handlers = {};
	const view = {
		jQuery: () => ( {
			one: ( event, handler ) => ( handlers[ event ] = handler ),
		} ),
		elementorFrontend: {},
	};
	const start = () => {
		view.elementorFrontend.hooks = { addAction: jest.fn() };
		if ( handlers[ 'elementor/frontend/init' ] ) {
			handlers[ 'elementor/frontend/init' ]();
		}
	};

	if ( started ) {
		start();
	}

	return { view, start };
}

describe( 'renderWidget', () => {
	afterEach( () => {
		delete window.mermaidBlocks;
	} );

	it( 'draws the diagram of the widget Elementor shows', () => {
		const element = document.createElement( 'div' );
		window.mermaidBlocks = { render: jest.fn() };

		renderWidget( [ element ] );

		expect( window.mermaidBlocks.render ).toHaveBeenCalledWith( element );
	} );

	it( 'does nothing before the renderer loaded, or without an element', () => {
		expect( () =>
			renderWidget( [ document.createElement( 'div' ) ] )
		).not.toThrow();

		window.mermaidBlocks = { render: jest.fn() };
		renderWidget( [] );
		renderWidget( undefined );

		expect( window.mermaidBlocks.render ).not.toHaveBeenCalled();
	} );
} );

describe( 'watchWidgets', () => {
	it( 'listens once Elementor has started, as in the editor', () => {
		const { view, start } = fakeElementor( false );

		watchWidgets( view );
		expect( view.elementorFrontend.hooks ).toBeUndefined();

		start();
		expect( view.elementorFrontend.hooks.addAction ).toHaveBeenCalledWith(
			READY_HOOK,
			renderWidget
		);
	} );

	it( 'listens at once when Elementor started before it loaded', () => {
		const { view } = fakeElementor( true );

		watchWidgets( view );

		expect( view.elementorFrontend.hooks.addAction ).toHaveBeenCalledWith(
			READY_HOOK,
			renderWidget
		);
	} );

	it( 'does nothing on a page without Elementor', () => {
		expect( () => watchWidgets( {} ) ).not.toThrow();
	} );
} );
