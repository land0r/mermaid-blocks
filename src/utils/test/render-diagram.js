import { renderDiagram } from '../render-diagram';

describe( 'renderDiagram', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'resolves to the svg on success and removes nothing', async () => {
		const bystander = document.createElement( 'div' );
		bystander.id = 'dabc';
		document.body.appendChild( bystander );

		const mermaid = {
			render: jest.fn().mockResolvedValue( { svg: '<svg></svg>' } ),
		};

		await expect(
			renderDiagram( mermaid, 'abc', 'graph' )
		).resolves.toEqual( { svg: '<svg></svg>' } );
		expect( mermaid.render ).toHaveBeenCalledWith( 'abc', 'graph' );
		expect( document.getElementById( 'dabc' ) ).not.toBeNull();
	} );

	it( 'returns the 1-based line and the message for a parse error', async () => {
		// Mermaid's own line number is dropped: it can differ from the line.
		const error = new Error( 'Parse error on line 4:\nboom' );
		error.hash = { line: 3, loc: { first_line: 2 }, expected: [] };
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		await expect(
			renderDiagram( mermaid, 'x', 'graph\nbad\nB' )
		).resolves.toEqual( {
			error: { message: 'boom', line: 2 },
		} );
	} );

	it( 'falls back to hash.line + 1 when loc is missing', async () => {
		const error = new Error( 'oops' );
		error.hash = { line: 3 };
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		const result = await renderDiagram( mermaid, 'x', 'a\nb\nc\nbad' );
		expect( result.error.line ).toBe( 4 );
	} );

	it( 'points at the line of the source, not of the text Mermaid parsed', async () => {
		// Mermaid removes the front matter and the comment before parsing.
		const code = '---\ntitle: T\n---\n%% note\ngraph\nbad';
		const error = new Error( 'Parse error on line 2:\nboom' );
		error.hash = { line: 1, loc: { first_line: 2 } };
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		const result = await renderDiagram( mermaid, 'x', code );
		expect( result.error.line ).toBe( 6 );
	} );

	it( 'reads the errors of diagram types that list them', async () => {
		// The shape pie, gitGraph and other newer diagram types reject with.
		const error = new Error(
			'Parsing failed:  Parse error on line 3, column 10: Expecting token of type `:` but found `85`.'
		);
		error.result = {
			lexerErrors: [],
			parserErrors: [
				{
					message: 'Expecting token of type `:` but found `85`.',
					token: { startLine: 3 },
				},
			],
		};
		const mermaid = { render: jest.fn().mockRejectedValue( error ) };

		await expect(
			renderDiagram( mermaid, 'x', 'pie\n"Dogs" : 3\n"Cats" 85' )
		).resolves.toEqual( {
			error: {
				message: 'Expecting token of type `:` but found `85`.',
				line: 3,
			},
		} );
	} );

	it( 'reads a lexing error first, and a line-less error as line null', async () => {
		const lexing = new Error( 'Parsing failed: …' );
		lexing.result = {
			lexerErrors: [ { message: 'unexpected character', line: 2 } ],
			parserErrors: [ { message: 'later', token: { startLine: 3 } } ],
		};
		const atEnd = new Error( 'Parsing failed: …' );
		atEnd.result = {
			parserErrors: [ { message: 'early end', token: {} } ],
		};
		const mermaid = {
			render: jest
				.fn()
				.mockRejectedValueOnce( lexing )
				.mockRejectedValueOnce( atEnd ),
		};

		await expect(
			renderDiagram( mermaid, 'x', 'pie\n"a" : 1 ^\n"b" 2' )
		).resolves.toEqual( {
			error: { message: 'unexpected character\nlater', line: 2 },
		} );
		await expect(
			renderDiagram( mermaid, 'x', 'pie\n"a" :' )
		).resolves.toEqual( {
			error: { message: 'early end', line: null },
		} );
	} );

	it( 'returns line null for errors without a hash', async () => {
		const mermaid = {
			render: jest
				.fn()
				.mockRejectedValue( new Error( 'No diagram type detected' ) ),
		};

		await expect( renderDiagram( mermaid, 'x', 'bad' ) ).resolves.toEqual( {
			error: { message: 'No diagram type detected', line: null },
		} );
	} );

	it( 'handles non-Error rejections', async () => {
		const mermaid = { render: jest.fn().mockRejectedValue( 'plain' ) };

		await expect( renderDiagram( mermaid, 'x', 'bad' ) ).resolves.toEqual( {
			error: { message: 'plain', line: null },
		} );
	} );

	it( 'removes orphaned #d<id> and #<id> elements after a failure', async () => {
		[ 'dprobe', 'probe', 'dother' ].forEach( ( id ) => {
			const el = document.createElement( 'div' );
			el.id = id;
			document.body.appendChild( el );
		} );
		const mermaid = {
			render: jest.fn().mockRejectedValue( new Error( 'bad' ) ),
		};

		await renderDiagram( mermaid, 'probe', 'bad' );

		expect( document.getElementById( 'dprobe' ) ).toBeNull();
		expect( document.getElementById( 'probe' ) ).toBeNull();
		expect( document.getElementById( 'dother' ) ).not.toBeNull();
	} );

	it( 'removes leftovers from the document Mermaid rendered in', async () => {
		const frameDocument = document.implementation.createHTMLDocument();
		const orphan = frameDocument.createElement( 'div' );
		orphan.id = 'dframe';
		frameDocument.body.appendChild( orphan );
		const mermaid = {
			render: jest.fn().mockRejectedValue( new Error( 'bad' ) ),
		};

		await renderDiagram( mermaid, 'frame', 'bad', frameDocument );

		expect( frameDocument.getElementById( 'dframe' ) ).toBeNull();
	} );

	it( 'does not throw when there is nothing to clean up', async () => {
		const mermaid = {
			render: jest.fn().mockRejectedValue( new Error( 'bad' ) ),
		};

		await expect(
			renderDiagram( mermaid, 'missing', 'bad' )
		).resolves.toHaveProperty( 'error' );
	} );
} );
