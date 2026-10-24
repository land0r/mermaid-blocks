/**
 * `@wordpress/*` packages are externals provided by WordPress at runtime and
 * are not installed in node_modules, so they are mocked as virtual modules.
 */
jest.mock(
	'@wordpress/element',
	() => ( {
		...jest.requireActual( 'react' ),
		createRoot: jest.requireActual( 'react-dom/client' ).createRoot,
	} ),
	{ virtual: true }
);
jest.mock(
	'@wordpress/i18n',
	() => ( {
		__: ( text ) => text,
		sprintf: ( format, value ) => format.replace( '%d', value ),
	} ),
	{ virtual: true }
);
jest.mock( '@wordpress/compose', () => ( { useInstanceId: () => 1 } ), {
	virtual: true,
} );
jest.mock(
	'@wordpress/components',
	() => {
		const { createElement: h } = jest.requireActual( 'react' );

		return {
			Notice: ( { children } ) =>
				h( 'div', { className: 'notice' }, children ),
		};
	},
	{ virtual: true }
);

import { act, createRoot } from '@wordpress/element';
// eslint-disable-next-line import/no-unresolved
import * as pele from 'pele/lazy';

import MermaidDiagram from '../mermaid-diagram';

global.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;

/**
 * Draws a preview, and waits for it.
 *
 * @param {Object} props The props of the preview.
 */
async function render( props ) {
	await act( async () => {
		root.render( <MermaidDiagram { ...props } /> );
	} );
}

const diagram = () => container.querySelector( '.mermaid-container__diagram' );

beforeEach( () => {
	// jsdom has no canvas: Pele then estimates the width of text.
	jest.spyOn(
		window.HTMLCanvasElement.prototype,
		'getContext'
	).mockReturnValue( null );
	window.pele = pele;
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
	delete window.pele;
	jest.restoreAllMocks();
} );

describe( 'the preview with Pele', () => {
	it( 'draws the code with Pele, in the light palette', async () => {
		await render( { code: 'flowchart LR\nA --> B', theme: 'auto' } );

		expect( diagram().querySelector( 'svg.pele' ) ).not.toBeNull();
		expect( diagram().style.getPropertyValue( '--pele-fg' ) ).toBe(
			'#1f1f1f'
		);
	} );

	it( 'draws a diagram that follows a dark block around it in the dark palette', async () => {
		container.style.backgroundColor = 'rgb(17, 24, 39)';

		await render( { code: 'flowchart LR\nA --> B', theme: 'auto' } );

		expect( diagram().style.getPropertyValue( '--pele-fg' ) ).toBe(
			'#e6e6e6'
		);
		expect( diagram().style.getPropertyValue( '--pele-bg' ) ).toBe(
			'rgb(17, 24, 39)'
		);
	} );

	it( 'draws a theme of its own light or dark, whatever is around it', async () => {
		container.style.backgroundColor = 'rgb(17, 24, 39)';

		await render( { code: 'flowchart LR\nA --> B', theme: 'forest' } );

		expect( diagram().style.getPropertyValue( '--pele-fg' ) ).toBe(
			'#1f1f1f'
		);
	} );

	it( 'writes the accessible title and description into the SVG', async () => {
		await render( {
			code: 'flowchart LR\nA --> B',
			title: 'A title',
			description: 'A description',
		} );

		expect( diagram().querySelector( 'title' ).textContent ).toBe(
			'A title'
		);
		expect( diagram().querySelector( 'desc' ).textContent ).toBe(
			'A description'
		);
	} );

	it( 'shows a syntax error with its line and the mark under the column', async () => {
		await render( { code: 'flowchart LR\nA --> B\nbad here ]]' } );

		expect( diagram() ).toBeNull();
		expect( container.textContent ).toContain( 'Syntax error on line 3' );
		expect( container.querySelector( 'pre' ).textContent ).toContain(
			'bad here ]]\n----^'
		);
	} );

	it( 'shows the error of a diagram Pele cannot draw', async () => {
		await render( { code: 'not a diagram' } );

		expect( diagram() ).toBeNull();
		expect( container.querySelector( 'pre' ).textContent ).not.toBe( '' );
	} );

	it( 'says so when no renderer is loaded', async () => {
		delete window.pele;

		await render( { code: 'flowchart LR\nA --> B' } );

		expect( container.querySelector( 'pre' ).textContent ).toContain(
			'not loaded'
		);
	} );
} );

describe( 'the preview and its width', () => {
	let observers;
	let frames;
	let width;

	class FakeResizeObserver {
		constructor( callback ) {
			this.callback = callback;
			this.observe = jest.fn();
			this.disconnect = jest.fn();
			observers.push( this );
		}
	}

	// A wide flowchart: vertical when the preview is narrow.
	const code =
		'flowchart LR\n' +
		Array.from( { length: 9 }, ( _, i ) => `N${ i } --> N${ i + 1 }` ).join(
			'\n'
		);

	const viewBox = () =>
		diagram()
			.querySelector( 'svg' )
			.getAttribute( 'viewBox' )
			.split( ' ' )
			.map( Number );

	// The editor is resized: the observer tells, and the frame runs.
	const resize = async ( to ) => {
		width = to;
		observers.forEach( ( observer ) => observer.callback( [] ) );

		await act( async () => {
			frames.splice( 0 ).forEach( ( callback ) => callback() );
		} );
	};

	beforeEach( () => {
		observers = [];
		frames = [];
		width = 1000;
		window.ResizeObserver = FakeResizeObserver;
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation(
			( callback ) => frames.push( callback )
		);
		Object.defineProperty( window.HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get: () => width,
		} );
	} );

	afterEach( () => {
		delete window.ResizeObserver;
		delete window.HTMLElement.prototype.clientWidth;
		delete window.mermaid;
	} );

	it( 'lays a Pele preview out for the width of the editor, and again when it changes', async () => {
		await render( { code } );

		const [ , , wideWidth, wideHeight ] = viewBox();

		expect( wideWidth ).toBeGreaterThan( wideHeight );

		await resize( 375 );

		const [ , , narrowWidth, narrowHeight ] = viewBox();

		expect( narrowHeight ).toBeGreaterThan( narrowWidth );

		// The drawing changed the height, not the width.
		await resize( 375 );

		expect( viewBox() ).toEqual( [ 0, 0, narrowWidth, narrowHeight ] );
	} );

	it( 'does not watch a Mermaid.js preview', async () => {
		delete window.pele;
		window.mermaid = {
			initialize: jest.fn(),
			render: async () => ( { svg: '<svg></svg>' } ),
		};

		await render( { code } );

		expect( observers ).toHaveLength( 0 );
	} );
} );
