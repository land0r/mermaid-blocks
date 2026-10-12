import renderDiagrams from '../render-diagrams';

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
} );
