import { setAccessibleText, withAccessibleText } from '../accessible-text';

// A diagram as Mermaid renders it, without and with `accTitle` and `accDescr`.
const PLAIN =
	'<svg id="d1" role="graphics-document document" aria-roledescription="flowchart-v2"><style>#d1{}</style><g></g></svg>';
const DESCRIBED =
	'<svg id="d2" aria-describedby="chart-desc-d2" aria-labelledby="chart-title-d2"><title id="chart-title-d2">From the code</title><desc id="chart-desc-d2">Described in the code</desc><style></style><g><title>A tooltip</title></g></svg>';

function createDiagram( markup ) {
	document.body.innerHTML = markup;

	return document.body.firstElementChild;
}

const children = ( svg ) =>
	Array.from( svg.children ).map( ( child ) => child.localName );

describe( 'setAccessibleText', () => {
	it( 'adds a title and a description the way Mermaid does', () => {
		const svg = createDiagram( PLAIN );

		setAccessibleText( svg, {
			title: 'Order flow',
			description: 'An order is paid, then shipped.',
		} );

		const [ title, description ] = svg.children;

		expect( children( svg ) ).toEqual( [ 'title', 'desc', 'style', 'g' ] );
		expect( title.namespaceURI ).toBe( 'http://www.w3.org/2000/svg' );
		expect( title.textContent ).toBe( 'Order flow' );
		expect( title.id ).toBe( 'chart-title-d1' );
		expect( svg.getAttribute( 'aria-labelledby' ) ).toBe( title.id );
		expect( description.textContent ).toBe(
			'An order is paid, then shipped.'
		);
		expect( description.id ).toBe( 'chart-desc-d1' );
		expect( svg.getAttribute( 'aria-describedby' ) ).toBe( description.id );
	} );

	it( 'adds one without the other', () => {
		const svg = createDiagram( PLAIN );

		setAccessibleText( svg, { title: 'Order flow' } );

		expect( children( svg ) ).toEqual( [ 'title', 'style', 'g' ] );
		expect( svg.hasAttribute( 'aria-describedby' ) ).toBe( false );
	} );

	it( 'replaces the title and the description from the source', () => {
		const svg = createDiagram( DESCRIBED );

		setAccessibleText( svg, { title: 'New', description: 'Newer' } );

		expect( children( svg ) ).toEqual( [ 'title', 'desc', 'style', 'g' ] );
		expect( svg.querySelector( '#chart-title-d2' ).textContent ).toBe(
			'New'
		);
		expect( svg.querySelector( '#chart-desc-d2' ).textContent ).toBe(
			'Newer'
		);
		// A title deeper in the diagram is a tooltip of one of its parts.
		expect( svg.querySelector( 'g > title' ).textContent ).toBe(
			'A tooltip'
		);
	} );

	it.each( [ [ undefined ], [ {} ], [ { title: '', description: '  ' } ] ] )(
		'keeps the title and the description from the source without text (%p)',
		( text ) => {
			const svg = createDiagram( DESCRIBED );
			const before = svg.outerHTML;

			setAccessibleText( svg, text );

			expect( svg.outerHTML ).toBe( before );
		}
	);

	it( 'writes the text as text', () => {
		const svg = createDiagram( PLAIN );

		setAccessibleText( svg, { title: '  a <b> & "c" [d]  ' } );

		expect( svg.querySelector( 'title' ).textContent ).toBe(
			'a <b> & "c" [d]'
		);
		expect( svg.querySelector( 'b' ) ).toBeNull();
	} );
} );

describe( 'withAccessibleText', () => {
	it( 'returns the markup with the title and the description', () => {
		const svg = createDiagram(
			withAccessibleText( PLAIN, {
				title: 'Order <flow>',
				description: 'Paid, then shipped.',
			} )
		);

		expect( svg.querySelector( 'title' ).textContent ).toBe(
			'Order <flow>'
		);
		expect( svg.getAttribute( 'aria-labelledby' ) ).toBe(
			'chart-title-d1'
		);
		expect( svg.querySelector( 'desc' ).textContent ).toBe(
			'Paid, then shipped.'
		);
		expect( svg.querySelector( 'style' ).textContent ).toBe( '#d1{}' );
	} );

	it( 'returns markup without a diagram as it is', () => {
		expect(
			withAccessibleText( '<p>No diagram</p>', { title: 'T' } )
		).toBe( '<p>No diagram</p>' );
	} );
} );
