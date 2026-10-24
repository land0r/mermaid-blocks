// eslint-disable-next-line import/no-unresolved
import * as pele from 'pele/lazy';

import { validateDiagram } from '../validate-diagram';

describe( 'validateDiagram', () => {
	afterEach( () => {
		delete window.mermaid;
	} );

	it( 'returns the type of a valid diagram', async () => {
		window.mermaid = {
			initialize: jest.fn(),
			parse: jest.fn().mockResolvedValue( { diagramType: 'sequence' } ),
		};

		await expect(
			validateDiagram( { code: 'sequenceDiagram\nA->>B: Hi' } )
		).resolves.toEqual( { valid: true, type: 'sequence' } );
	} );

	it( 'returns the error and its line for an invalid diagram', async () => {
		const error = new Error( 'Parse error on line 2:\nboom' );
		error.hash = { line: 1, loc: { first_line: 2 } };
		window.mermaid = {
			initialize: jest.fn(),
			parse: jest.fn().mockRejectedValue( error ),
		};

		await expect(
			validateDiagram( { code: 'graph TD\nA -->' } )
		).resolves.toEqual( {
			valid: false,
			error: { message: 'boom', line: 2 },
		} );
	} );

	it( 'leaves out a line it does not know', async () => {
		window.mermaid = {
			initialize: jest.fn(),
			parse: jest
				.fn()
				.mockRejectedValue( new Error( 'No diagram type detected' ) ),
		};

		await expect(
			validateDiagram( { code: 'nonsense' } )
		).resolves.toEqual( {
			valid: false,
			error: { message: 'No diagram type detected' },
		} );
	} );

	it( 'throws when no renderer is loaded', async () => {
		await expect( validateDiagram( { code: 'graph' } ) ).rejects.toThrow(
			'Neither Mermaid.js nor Pele is loaded on this page.'
		);
	} );

	describe( 'with Pele', () => {
		beforeEach( () => {
			jest.spyOn(
				window.HTMLCanvasElement.prototype,
				'getContext'
			).mockReturnValue( null );
			window.pele = pele;
		} );

		afterEach( () => {
			jest.restoreAllMocks();
		} );

		it.each( [
			[ 'flowchart LR\nA --> B', 'flowchart-v2' ],
			[ 'sequenceDiagram\nA->>B: Hi', 'sequence' ],
			[ 'classDiagram\nA <|-- B', 'classDiagram' ],
			[ 'stateDiagram-v2\n[*] --> A', 'stateDiagram' ],
			[ 'pie\n"a": 1', 'pie' ],
		] )(
			"returns the type of %p by Mermaid.js's name",
			async ( code, type ) => {
				await expect( validateDiagram( { code } ) ).resolves.toEqual( {
					valid: true,
					type,
				} );
			}
		);

		it( 'returns the error and its line', async () => {
			const result = await validateDiagram( {
				code: '%%{init: {}}%%\nflowchart LR\nA --> B\nbad here ]]',
			} );

			expect( result.valid ).toBe( false );
			expect( result.error.line ).toBe( 4 );
			expect( result.error.message ).toContain( 'bad here ]]' );
		} );
	} );
} );
