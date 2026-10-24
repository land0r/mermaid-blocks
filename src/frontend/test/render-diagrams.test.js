import renderDraw, {
	isOutdated,
	redrawDiagram as redrawWith,
} from '../render-diagrams';
// eslint-disable-next-line import/no-unresolved
import * as pele from 'pele/lazy';
import { createMermaidRenderer } from '../../renderers/mermaid';
import { createPeleRenderer } from '../../renderers/pele';
import { DARK, LIGHT, PALETTES } from '../../utils/pele-palette';

// The tests drive Mermaid.js through the renderer interface.
const renderDiagrams = ( mermaid, ...rest ) =>
	renderDraw( createMermaidRenderer( mermaid ), ...rest );
const redrawDiagram = ( mermaid, ...rest ) =>
	redrawWith( createMermaidRenderer( mermaid ), ...rest );

const CODE = 'graph TD\nA["x & y <b> &amp; z"] --> B';

function setup( codes = [ CODE ] ) {
	document.body.innerHTML = '';
	codes.forEach( ( code ) => {
		const block = document.createElement( 'div' );
		block.className = 'mermaid-blocks-diagram';
		const pre = document.createElement( 'pre' );
		pre.className = 'mermaid-blocks-diagram__source';
		// Mimic esc_textarea() output: parsed back through the HTML parser.
		pre.innerHTML = code
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' );
		block.appendChild( pre );
		document.body.appendChild( block );
	} );
}

const fake = ( impl ) => ( {
	render: jest.fn( impl || ( async () => ( { svg: '<svg></svg>' } ) ) ),
} );

// A Mermaid that can be given a theme, and gives each SVG the id it was asked.
const themed = () => ( {
	initialize: jest.fn(),
	render: jest.fn( async ( id ) => ( { svg: `<svg id="${ id }"></svg>` } ) ),
} );

const getDiagram = () => document.querySelector( '.mermaid-blocks-diagram' );

const getCanvas = ( diagram ) =>
	diagram.querySelector( '.mermaid-blocks-diagram__canvas' );

// The palette of a Pele diagram, by the colour its canvas gives the text.
const getPalette = ( canvas ) =>
	[ LIGHT, DARK ].find(
		( name ) =>
			PALETTES[ name ][ '--pele-fg' ] ===
			canvas.style.getPropertyValue( '--pele-fg' )
	);

// Puts a diagram on a dark surface.
function darken( diagram ) {
	const section = document.createElement( 'section' );
	section.style.backgroundColor = 'rgb(17, 24, 39)';
	diagram.replaceWith( section );
	section.appendChild( diagram );
}

describe( 'renderDiagrams', () => {
	beforeEach( () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );
	afterEach( () => jest.restoreAllMocks() );

	it( 'renders diagrams and hides the source', async () => {
		setup( [ CODE, 'graph LR\nA-->B' ] );
		const bindFunctions = jest.fn();
		const m = fake( async () => ( { svg: '<svg></svg>', bindFunctions } ) );
		await renderDiagrams( m );

		document
			.querySelectorAll( '.mermaid-blocks-diagram' )
			.forEach( ( block ) => {
				expect( block.classList.contains( 'is-rendered' ) ).toBe(
					true
				);
				expect(
					block.querySelector( '.mermaid-blocks-diagram__canvas svg' )
				).not.toBeNull();
				expect(
					block.querySelector( '.mermaid-blocks-diagram__source' )
						.hidden
				).toBe( true );
			} );
		expect( bindFunctions ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'passes the exact textContent', async () => {
		setup();
		const m = fake();
		await renderDiagrams( m );
		expect( m.render ).toHaveBeenCalledWith( expect.any( String ), CODE );
	} );

	it( 'isolates failures and removes the orphan element', async () => {
		setup( [ 'bad', 'good' ] );
		const m = fake( async ( id, code ) => {
			if ( code === 'bad' ) {
				const orphan = document.createElement( 'div' );
				orphan.id = 'd' + id;
				document.body.appendChild( orphan );
				throw new Error( 'parse error' );
			}
			return { svg: '<svg></svg>' };
		} );
		await renderDiagrams( m );

		const [ bad, good ] = document.querySelectorAll(
			'.mermaid-blocks-diagram'
		);
		expect( bad.classList.contains( 'has-error' ) ).toBe( true );
		expect( bad.classList.contains( 'is-rendered' ) ).toBe( false );
		expect(
			bad.querySelector( '.mermaid-blocks-diagram__source' ).hidden
		).toBe( false );
		expect( good.classList.contains( 'is-rendered' ) ).toBe( true );
		const badId = m.render.mock.calls[ 0 ][ 0 ];
		expect( document.getElementById( 'd' + badId ) ).toBeNull();
		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalled();
	} );

	it( 'logs the line the error points at', async () => {
		setup( [ 'graph TD\nbad' ] );
		const error = new Error( 'Parse error on line 3:\nboom' );
		error.hash = { loc: { first_line: 2 } };

		await renderDiagrams(
			fake( async () => {
				throw error;
			} )
		);

		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalledWith(
			'Mermaid Blocks: failed to render diagram.',
			'Line 2: boom'
		);
	} );

	it( 'does not render twice', async () => {
		setup( [ 'a', 'bad' ] );
		const m = fake( async ( id, code ) => {
			if ( code === 'bad' ) {
				throw new Error( 'x' );
			}
			return { svg: '<svg></svg>' };
		} );
		await renderDiagrams( m );
		await renderDiagrams( m );
		expect( m.render ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'renders only the diagrams inside the given root', async () => {
		setup( [ 'outside', 'inside' ] );
		const [ outside, inside ] = document.querySelectorAll(
			'.mermaid-blocks-diagram'
		);
		const container = document.createElement( 'section' );
		container.appendChild( inside );
		document.body.appendChild( container );
		const m = fake();

		await renderDiagrams( m, container );

		expect( m.render ).toHaveBeenCalledTimes( 1 );
		expect( m.render ).toHaveBeenCalledWith(
			expect.any( String ),
			'inside'
		);
		expect( inside.classList.contains( 'is-rendered' ) ).toBe( true );
		expect( outside.classList.contains( 'is-rendered' ) ).toBe( false );
	} );

	it( 'renders the root itself when it is a diagram', async () => {
		setup( [ 'graph LR\nA-->B' ] );
		const diagram = document.querySelector( '.mermaid-blocks-diagram' );
		const m = fake();

		await renderDiagrams( m, diagram );

		expect( diagram.classList.contains( 'is-rendered' ) ).toBe( true );
	} );

	it( 'puts the diagram in place of its source, above a caption', async () => {
		setup();
		const diagram = getDiagram();
		diagram.appendChild( document.createElement( 'figcaption' ) );

		await renderDiagrams( fake() );

		expect(
			Array.from( diagram.children ).map(
				( child ) => child.className || child.localName
			)
		).toEqual( [
			'mermaid-blocks-diagram__source',
			'mermaid-blocks-diagram__canvas',
			'figcaption',
		] );
	} );

	it( 'draws a diagram in the theme it asks for', async () => {
		setup();
		const diagram = getDiagram();
		diagram.dataset.mermaidTheme = 'forest';
		darken( diagram );
		const m = themed();

		await renderDiagrams( m );

		expect( m.initialize ).toHaveBeenCalledWith(
			expect.objectContaining( { theme: 'forest' } )
		);
		expect( getCanvas( diagram ).dataset.mermaidTheme ).toBe( 'forest' );
	} );

	it( 'draws a diagram that follows the page for the surface it is on', async () => {
		setup( [ 'graph LR\nA-->B', 'graph LR\nC-->D', 'graph LR\nE-->F' ] );
		const [ onLight, onDark, unknown ] = document.querySelectorAll(
			'.mermaid-blocks-diagram'
		);
		onDark.dataset.mermaidTheme = 'auto';
		darken( onDark );
		unknown.dataset.mermaidTheme = 'no-such-theme';
		const m = themed();

		await renderDiagrams( m );

		expect( getCanvas( onLight ).dataset.mermaidTheme ).toBe(
			'auto-light'
		);
		expect( getCanvas( onDark ).dataset.mermaidTheme ).toBe( 'auto-dark' );
		expect( getCanvas( unknown ).dataset.mermaidTheme ).toBe(
			'auto-light'
		);
		expect(
			m.initialize.mock.calls.map( ( [ { theme } ] ) => theme )
		).toEqual(
			// For the second diagram, then back for the third.
			[ 'dark', undefined ]
		);
	} );

	it( 'gives the diagram the title and the description it asks for', async () => {
		setup();
		const diagram = getDiagram();
		diagram.dataset.mermaidTitle = 'Order flow';
		diagram.dataset.mermaidDescription = 'Paid, then shipped.';

		await renderDiagrams( themed() );

		const svg = diagram.querySelector( 'svg' );
		const title = svg.querySelector( 'title' );
		const description = svg.querySelector( 'desc' );

		expect( title.textContent ).toBe( 'Order flow' );
		expect( svg.getAttribute( 'aria-labelledby' ) ).toBe( title.id );
		expect( description.textContent ).toBe( 'Paid, then shipped.' );
		expect( svg.getAttribute( 'aria-describedby' ) ).toBe( description.id );
	} );

	it( 'adds no title or description to a diagram that asks for none', async () => {
		setup();

		await renderDiagrams( themed() );

		expect( getDiagram().querySelector( 'title, desc' ) ).toBeNull();
	} );
} );

describe( 'isOutdated', () => {
	afterEach( () => jest.restoreAllMocks() );

	it( 'tells when the surface of a diagram that follows the page turned', async () => {
		setup();
		const diagram = getDiagram();

		expect( isOutdated( diagram ) ).toBe( false );

		await renderDiagrams( themed() );

		expect( isOutdated( diagram ) ).toBe( false );

		darken( diagram );

		expect( isOutdated( diagram ) ).toBe( true );
	} );

	it( 'never tells for a diagram with a theme of its own', async () => {
		setup();
		const diagram = getDiagram();
		diagram.dataset.mermaidTheme = 'neutral';

		await renderDiagrams( themed() );
		darken( diagram );

		expect( isOutdated( diagram ) ).toBe( false );
	} );
} );

describe( 'redrawDiagram', () => {
	beforeEach( () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );
	afterEach( () => jest.restoreAllMocks() );

	it( 'draws the diagram again in place, without its old controls', async () => {
		setup();
		const diagram = getDiagram();
		diagram.appendChild( document.createElement( 'figcaption' ) );
		const m = themed();
		await renderDiagrams( m );

		// As controls.js and zoom.js leave a zoomed diagram.
		const previous = getCanvas( diagram );
		const toolbar = document.createElement( 'div' );
		toolbar.className = 'mermaid-blocks-diagram__toolbar';
		diagram.insertBefore( toolbar, previous );
		diagram.classList.add( 'is-zoomed', 'is-panning' );

		darken( diagram );

		await expect( redrawDiagram( m, diagram ) ).resolves.toBe( true );

		expect(
			Array.from( diagram.children ).map(
				( child ) => child.className || child.localName
			)
		).toEqual( [
			'mermaid-blocks-diagram__source',
			'mermaid-blocks-diagram__canvas',
			'figcaption',
		] );
		expect( getCanvas( diagram ) ).not.toBe( previous );
		expect( getCanvas( diagram ).dataset.mermaidTheme ).toBe( 'auto-dark' );
		expect( diagram.className ).toBe(
			'mermaid-blocks-diagram is-rendered'
		);
		expect(
			diagram.querySelector( '.mermaid-blocks-diagram__source' ).hidden
		).toBe( true );
		expect( isOutdated( diagram ) ).toBe( false );
	} );

	it( 'keeps the diagram when it cannot be drawn again', async () => {
		setup();
		const diagram = getDiagram();
		const m = themed();
		await renderDiagrams( m );
		const previous = getCanvas( diagram );

		darken( diagram );
		m.render.mockRejectedValueOnce( new Error( 'boom' ) );

		await expect( redrawDiagram( m, diagram ) ).resolves.toBe( false );

		expect( getCanvas( diagram ) ).toBe( previous );
		expect( diagram.className ).toBe(
			'mermaid-blocks-diagram is-rendered'
		);
		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalled();
	} );

	it( 'leaves alone a diagram that has not rendered', async () => {
		setup();
		const m = themed();

		await expect( redrawDiagram( m, getDiagram() ) ).resolves.toBe( false );

		expect( m.render ).not.toHaveBeenCalled();
	} );

	it( 'draws one diagram once at a time', async () => {
		setup();
		const diagram = getDiagram();
		const m = themed();
		await renderDiagrams( m );
		darken( diagram );

		const results = await Promise.all( [
			redrawDiagram( m, diagram ),
			redrawDiagram( m, diagram ),
		] );

		expect( results ).toEqual( [ true, false ] );
		expect(
			diagram.querySelectorAll( '.mermaid-blocks-diagram__canvas' )
		).toHaveLength( 1 );
	} );
} );

describe( 'renderDiagrams with Pele', () => {
	// jsdom has no canvas, so the text is measured by an estimate.
	const renderer = createPeleRenderer( pele, {
		measurer: { width: ( text, size ) => text.length * size * 0.55 },
	} );

	beforeEach( () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );
	afterEach( () => jest.restoreAllMocks() );

	it( 'draws the markup as a canvas with an SVG, and hides the source', async () => {
		setup( [ 'flowchart LR\nA --> B' ] );

		await renderDraw( renderer );

		const diagram = getDiagram();

		expect( diagram.classList.contains( 'is-rendered' ) ).toBe( true );
		expect( getCanvas( diagram ).querySelector( 'svg' ) ).not.toBeNull();
		expect(
			diagram.querySelector( '.mermaid-blocks-diagram__source' ).hidden
		).toBe( true );
	} );

	it( 'writes the accessible title and description into the SVG', async () => {
		setup( [ 'flowchart LR\nA --> B' ] );
		getDiagram().dataset.mermaidTitle = 'A title';
		getDiagram().dataset.mermaidDescription = 'A description';

		await renderDraw( renderer );

		const svg = getCanvas( getDiagram() ).querySelector( 'svg' );

		expect( svg.querySelector( 'title' ).textContent ).toBe( 'A title' );
		expect( svg.querySelector( 'desc' ).textContent ).toBe(
			'A description'
		);
	} );

	it( 'gives each diagram of a page ids of its own', async () => {
		setup( [ 'flowchart LR\nA --> B', 'flowchart LR\nA --> B' ] );
		document
			.querySelectorAll( '.mermaid-blocks-diagram' )
			.forEach( ( diagram ) => {
				diagram.dataset.mermaidTitle = 'T';
			} );

		await renderDraw( renderer );

		const ids = Array.from( document.querySelectorAll( '[id]' ) ).map(
			( element ) => element.id
		);

		expect( ids.length ).toBeGreaterThan( 1 );
		expect( new Set( ids ).size ).toBe( ids.length );
	} );

	it( 'leaves the code and logs the line of a failed diagram', async () => {
		setup( [ 'flowchart LR\nA --> B\nbad here ]]' ] );

		await renderDraw( renderer );

		const diagram = getDiagram();

		expect( diagram.classList.contains( 'has-error' ) ).toBe( true );
		expect( getCanvas( diagram ) ).toBeNull();
		expect(
			diagram.querySelector( '.mermaid-blocks-diagram__source' ).hidden
		).toBe( false );
		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalledWith(
			'Mermaid Blocks: failed to render diagram.',
			expect.stringMatching( /^Line 3: / )
		);
	} );

	it( 'draws a diagram that follows a dark surface in the dark palette', async () => {
		setup( [ 'flowchart LR\nA --> B' ] );
		darken( getDiagram() );

		await renderDraw( renderer );

		const canvas = getCanvas( getDiagram() );

		expect( getPalette( canvas ) ).toBe( 'dark' );
		expect( canvas.style.getPropertyValue( '--pele-fg' ) ).toBe(
			'#e6e6e6'
		);
		// The boxes behind the labels take the colour of the surface.
		expect( canvas.style.getPropertyValue( '--pele-bg' ) ).toBe(
			'rgb(17, 24, 39)'
		);
	} );

	it( "draws a light page in the light palette, with the palette's background", async () => {
		setup( [ 'flowchart LR\nA --> B' ] );

		await renderDraw( renderer );

		const canvas = getCanvas( getDiagram() );

		expect( getPalette( canvas ) ).toBe( 'light' );
		expect( canvas.style.getPropertyValue( '--pele-bg' ) ).toBe(
			'#ffffff'
		);
	} );

	it( 'draws a theme written in the code in the palette it counts as', async () => {
		setup( [ '%%{init: {"theme": "dark"}}%%\nflowchart LR\nA --> B' ] );

		await renderDraw( renderer );

		expect( getPalette( getCanvas( getDiagram() ) ) ).toBe( 'dark' );
	} );

	it( 'gives the other palette in place when the page turns dark', async () => {
		setup( [ 'flowchart LR\nA --> B' ] );
		const diagram = getDiagram();

		await renderDraw( renderer );

		const canvas = getCanvas( diagram );
		const svg = canvas.querySelector( 'svg' );
		const toolbar = document.createElement( 'div' );
		toolbar.className = 'mermaid-blocks-diagram__toolbar';
		diagram.appendChild( toolbar );

		expect( getPalette( canvas ) ).toBe( 'light' );
		expect( isOutdated( diagram ) ).toBe( false );

		darken( diagram );

		expect( isOutdated( diagram ) ).toBe( true );

		// Not drawn again: the controls are not to be added again.
		await expect( redrawWith( renderer, diagram ) ).resolves.toBe( false );

		expect( getCanvas( diagram ) ).toBe( canvas );
		expect( canvas.querySelector( 'svg' ) ).toBe( svg );
		expect(
			diagram.querySelector( '.mermaid-blocks-diagram__toolbar' )
		).toBe( toolbar );
		expect( getPalette( canvas ) ).toBe( 'dark' );
		expect( canvas.dataset.mermaidTheme ).toBe( 'auto-dark' );
		expect( isOutdated( diagram ) ).toBe( false );
	} );

	it( 'keeps the palette of a theme written in the code when the page turns dark', async () => {
		setup( [ '%%{init: {"theme": "forest"}}%%\nflowchart LR\nA --> B' ] );
		const diagram = getDiagram();

		await renderDraw( renderer );
		darken( diagram );
		await redrawWith( renderer, diagram );

		expect( getPalette( getCanvas( diagram ) ) ).toBe( 'light' );
	} );
} );
