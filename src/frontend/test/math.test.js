import { typeset } from '../math';

describe( 'typeset()', () => {
	it( 'gives the MathML of a formula', () => {
		const result = typeset( 'x^2 + y^2 = z^2', 16, document );

		expect( result.html ).toMatch( /^<math\b/ );
		expect( result.html ).toContain( '<msup>' );
		expect( typeof result.width ).toBe( 'number' );
		expect( typeof result.height ).toBe( 'number' );
	} );

	it( 'gives null for TeX Temml can not parse', () => {
		expect( typeset( '\\frac{a', 16, document ) ).toBeNull();
		expect( typeset( '\\nosuchmacro', 16, document ) ).toBeNull();
	} );

	it( 'measures in the document it is given, and leaves nothing behind', () => {
		const other = document.implementation.createHTMLDocument( '' );
		const measured = [];
		const spy = jest
			.spyOn( window.Element.prototype, 'getBoundingClientRect' )
			.mockImplementation( function () {
				const box = this.closest( 'span' );

				measured.push( {
					doc: this.ownerDocument,
					size: box.style.fontSize,
					hidden: box.style.visibility,
				} );

				return { width: 30, height: 12 };
			} );

		const result = typeset( 'a+b', 20, other );

		spy.mockRestore();

		expect( measured.length ).toBeGreaterThan( 0 );
		expect( measured.every( ( m ) => m.doc === other ) ).toBe( true );
		expect( measured[ 0 ].size ).toBe( '20px' );
		expect( measured[ 0 ].hidden ).toBe( 'hidden' );
		expect( result.width ).toBe( 30 );
		expect( result.height ).toBe( 12 );
		expect( other.body.children ).toHaveLength( 0 );
		expect( document.body.children ).toHaveLength( 0 );
	} );
} );
