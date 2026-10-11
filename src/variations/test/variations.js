// `@wordpress/i18n` is a WordPress runtime external, not installed locally.
jest.mock( '@wordpress/i18n', () => ( { __: ( text ) => text } ), {
	virtual: true,
} );

import classDiagram from '../class-diagram';
import flowchart from '../flowchart';
import mindMap from '../mind-map';
import sequenceDiagram from '../sequence-diagram';
import stateDiagram from '../state-diagram';

const cases = [
	[ 'class-diagram', classDiagram, 'classDiagram' ],
	[ 'flowchart', flowchart, 'flowchart' ],
	[ 'mind-map', mindMap, 'mindmap' ],
	[ 'sequence-diagram', sequenceDiagram, 'sequenceDiagram' ],
	[ 'state-diagram', stateDiagram, 'stateDiagram-v2' ],
];

describe( 'block variations', () => {
	it( 'have unique names', () => {
		const names = cases.map( ( [ , variation ] ) => variation.name );
		expect( new Set( names ).size ).toBe( names.length );
	} );

	describe.each( cases )( '%s', ( file, variation, keyword ) => {
		it( 'has a non-empty name, title and description', () => {
			expect( variation.name ).toEqual( expect.any( String ) );
			expect( variation.name ).not.toBe( '' );
			expect( variation.title ).toEqual( expect.any( String ) );
			expect( variation.title ).not.toBe( '' );
			expect( variation.description ).toEqual( expect.any( String ) );
			expect( variation.description ).not.toBe( '' );
		} );

		it( 'has a scope', () => {
			expect( variation.scope ).toBeTruthy();
		} );

		it( 'has code starting with a Mermaid diagram keyword', () => {
			const [ firstLine ] = variation.attributes.code.split( '\n' );
			expect( firstLine.startsWith( keyword ) ).toBe( true );
		} );
	} );
} );
