import { readFileSync } from 'fs';
import { join } from 'path';

// eslint-disable-next-line import/no-unresolved
import * as pele from 'pele/lazy';

import { createPeleRenderer } from '../pele';

// jsdom has no canvas, so the text is measured by an estimate.
const measurer = { width: ( text, size ) => text.length * size * 0.55 };

const renderer = createPeleRenderer( pele, { measurer } );

const draw = ( code, id = 'x', element = document.body ) =>
	renderer.draw( code, 'auto-light', element, id );

/**
 * Returns the starter code of each diagram type of the plugin, from the PHP
 * class that is the one source of it.
 *
 * @return {Object<string, string>} The code, by the name of the type.
 */
function getStarterCodes() {
	const php = readFileSync(
		join( __dirname, '../../../includes/DiagramTypes.php' ),
		'utf8'
	);
	const codes = {};

	for ( const match of php.matchAll(
		/'([\w-]+)'\s*=>\s*array\(\s*'title'[\s\S]*?'code'\s*=>\s*implode\(\s*"\\n",\s*array\(([\s\S]*?)\n\t+\)\n\t+\),/g
	) ) {
		codes[ match[ 1 ] ] = Array.from(
			match[ 2 ].matchAll( /^\s*'((?:[^'\\]|\\.)*)',?$/gm ),
			( line ) => line[ 1 ].replace( /\\(['\\])/g, '$1' )
		).join( '\n' );
	}

	return codes;
}

describe( 'the Pele renderer', () => {
	describe( 'draw', () => {
		const starters = getStarterCodes();

		it( 'reads the starter code of every diagram type', () => {
			expect( Object.keys( starters ).length ).toBeGreaterThanOrEqual(
				5
			);
			Object.values( starters ).forEach( ( code ) =>
				expect( code.length ).toBeGreaterThan( 10 )
			);
		} );

		it.each( Object.keys( starters ) )(
			'draws the starter code of the %s type',
			async ( name ) => {
				const result = await draw( starters[ name ] );

				expect( result.error ).toBeUndefined();
				expect( result.svg ).toMatch( /^<svg\b/ );
			}
		);

		it.each( [
			[ 'flowchart', 'flowchart TD\nA --> B' ],
			[ 'sequence', 'sequenceDiagram\nA->>B: Hi' ],
			[ 'pie', 'pie\n"Dogs": 3\n"Cats": 5' ],
			[ 'gantt', 'gantt\nsection S\nTask :a1, 2024-01-01, 3d' ],
			[ 'er', 'erDiagram\nA ||--o{ B : has' ],
			[ 'state', 'stateDiagram-v2\n[*] --> A' ],
			[ 'mindmap', 'mindmap\nroot\n  child' ],
			[ 'timeline', 'timeline\n2020 : x' ],
		] )( 'draws a %s diagram', async ( name, code ) => {
			const result = await draw( code );

			expect( result.error ).toBeUndefined();
			expect( result.svg ).toMatch( /^<svg\b/ );
		} );

		it( 'shows labels with & < > " \' [ ] as they were typed', async () => {
			const { svg } = await draw(
				'flowchart LR\nA["x & y #lt;i#gt; #quot; \' [z]"] --> B'
			);
			const template = document.createElement( 'template' );
			template.innerHTML = svg;
			const text = template.content.querySelector( 'svg' ).textContent;

			expect( text ).toContain( 'x & y <i>' );
			expect( text ).toContain( '" \' [z]' );
			// Escaped once: no entity is left standing in the text.
			expect( text ).not.toContain( '&amp;' );
			expect( text ).not.toContain( '&lt;' );
		} );

		it( 'gives two drawings no id in common', async () => {
			// The ids are those of the title and the description, among others.
			const code = 'flowchart LR\naccTitle: T\naccDescr: D\nA --> B';
			const ids = ( svg ) =>
				Array.from(
					svg.matchAll( /\sid="([^"]+)"/g ),
					( m ) => m[ 1 ]
				);

			const first = ids( ( await draw( code, 'first' ) ).svg );
			const second = ids( ( await draw( code, 'second' ) ).svg );

			expect( first.length ).toBeGreaterThan( 0 );
			expect( first.filter( ( id ) => second.includes( id ) ) ).toEqual(
				[]
			);
		} );

		it( 'gives the SVG the id of the drawing', async () => {
			const { svg } = await draw( 'flowchart LR\nA --> B', 'my-id' );

			expect( svg ).toMatch( /^<svg id="my-id" / );
		} );

		it( 'scales the picture down with its column, whatever the width', async () => {
			const { svg } = await draw( 'flowchart LR\nA --> B' );

			expect( svg ).toMatch( /max-width:100%/ );
			// One picture at every width: no switch of direction.
			expect( svg ).not.toMatch( /<style[^>]*>[^<]*@container/ );
		} );

		it( 'draws in the font of the element', async () => {
			const element = document.createElement( 'div' );
			element.style.fontFamily = 'Georgia, serif';
			document.body.appendChild( element );

			const { svg } = await draw( 'flowchart LR\nA --> B', 'f', element );
			element.remove();

			expect( svg ).toContain( '--pele-font:Georgia, serif;' );
		} );

		it( 'draws a diagram it has no code for as a failed diagram', async () => {
			const result = await draw( 'nonsense' );

			expect( result.svg ).toBeUndefined();
			expect( result.error ).toEqual( {
				message: expect.stringContaining( 'No diagram type' ),
				line: null,
			} );
		} );
	} );

	describe( 'errors', () => {
		it( "gives the line of the code, without Pele's prefix", async () => {
			const result = await draw( 'flowchart LR\nA --> B\nbad here ]]' );

			expect( result.error.line ).toBe( 3 );
			expect( result.error.message ).not.toMatch(
				/^Parse error on line/
			);
			// The snippet and the mark under the column stay.
			expect( result.error.message ).toContain( 'bad here ]]\n----^' );
		} );

		it( 'counts the front matter, directives, comments and blank lines', async () => {
			const code = [
				'---',
				'title: Hi',
				'---',
				'%%{init: {"theme": "forest"}}%%',
				'',
				'%% a comment',
				'flowchart LR',
				'A --> B',
				'bad here ]]',
			].join( '\n' );

			const result = await draw( code );

			expect( result.error.line ).toBe( 9 );
		} );
	} );

	describe( 'parse', () => {
		it.each( [
			[ 'flowchart LR\nA --> B', 'flowchart-v2' ],
			[ 'classDiagram\nA <|-- B', 'classDiagram' ],
			[ 'stateDiagram-v2\n[*] --> A', 'stateDiagram' ],
			[ 'sequenceDiagram\nA->>B: Hi', 'sequence' ],
		] )(
			'names the type of %p as Mermaid.js does',
			async ( code, type ) => {
				await expect( renderer.parse( code ) ).resolves.toEqual( {
					type,
				} );
			}
		);

		it( 'gives an error and its line', async () => {
			const result = await renderer.parse(
				'flowchart LR\nA --> B\nbad ]]'
			);

			expect( result.error.line ).toBe( 3 );
		} );
	} );
} );
