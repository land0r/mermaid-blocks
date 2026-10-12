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

	it( 'throws when Mermaid is not loaded', async () => {
		await expect( validateDiagram( { code: 'graph' } ) ).rejects.toThrow(
			'Mermaid is not loaded'
		);
	} );
} );
