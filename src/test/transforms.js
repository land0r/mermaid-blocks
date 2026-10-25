/**
 * `@wordpress/*` packages are externals provided by WordPress at runtime and
 * are not installed in node_modules, so they are mocked as virtual modules.
 */
jest.mock(
	'@wordpress/blocks',
	() => ( {
		createBlock: jest.fn( ( name, attributes ) => ( {
			name,
			attributes,
		} ) ),
	} ),
	{ virtual: true }
);

// Minimal stand-in for decodeEntities covering the entities used below.
jest.mock(
	'@wordpress/html-entities',
	() => ( {
		decodeEntities: ( text ) =>
			text
				.replace( /&gt;/g, '>' )
				.replace( /&lt;/g, '<' )
				.replace( /&quot;/g, '"' )
				.replace( /&amp;/g, '&' ),
	} ),
	{ virtual: true }
);

import transforms from '../transforms';

const { isMatch, transform } = transforms.from[ 0 ];

const para = ( content ) => ( { content } );

// What a rich text attribute, such as a paragraph's content, holds.
const richText = ( html ) => ( { content: { toHTMLString: () => html } } );

describe( 'transforms.from[0] (markdown to Mermaid block)', () => {
	describe( 'isMatch', () => {
		it( 'returns false for an empty array', () => {
			expect( isMatch( [] ) ).toBe( false );
		} );

		it( 'matches when first block starts with ```mermaid and last ends with ```', () => {
			expect(
				isMatch( [
					para( '```mermaid' ),
					para( 'flowchart LR' ),
					para( '```' ),
				] )
			).toBe( true );
		} );

		it( 'matches a single block containing the whole fence', () => {
			expect(
				isMatch( [ para( '  ```mermaid\nflowchart LR\n```  ' ) ] )
			).toBe( true );
		} );

		it( 'does not match when the first block lacks the opening fence', () => {
			expect( isMatch( [ para( 'flowchart LR' ), para( '```' ) ] ) ).toBe(
				false
			);
		} );

		it( 'does not match when the last block lacks the closing fence', () => {
			expect(
				isMatch( [ para( '```mermaid' ), para( 'flowchart LR' ) ] )
			).toBe( false );
		} );

		it( 'does not match a plain ``` fence without the mermaid language', () => {
			expect( isMatch( [ para( '```js' ), para( '```' ) ] ) ).toBe(
				false
			);
		} );

		it( 'matches rich text values', () => {
			expect(
				isMatch( [
					richText( '```mermaid' ),
					richText( 'flowchart LR' ),
					richText( '```' ),
				] )
			).toBe( true );
		} );

		it( 'does not match a block without a content attribute (#6)', () => {
			expect( isMatch( [ {} ] ) ).toBe( false );
			expect( isMatch( [ { url: 'image.png' }, {} ] ) ).toBe( false );
		} );

		it.each( [
			[ 'an array', [ '```mermaid', '```' ] ],
			[ 'an object', { text: '```mermaid```' } ],
			[ 'a number', 42 ],
			[ 'null', null ],
		] )(
			'does not match a block whose content is %s (#6)',
			( _, content ) => {
				expect( isMatch( [ { content } ] ) ).toBe( false );
			}
		);

		it( 'does not match when a block between the fences has no text', () => {
			expect(
				isMatch( [ para( '```mermaid' ), {}, para( '```' ) ] )
			).toBe( false );
		} );
	} );

	describe( 'transform', () => {
		it( 'creates a graphdraw/diagram block', () => {
			const block = transform( [
				para( '```mermaid' ),
				para( 'flowchart LR' ),
				para( '```' ),
			] );
			expect( block.name ).toBe( 'graphdraw/diagram' );
			expect( block.attributes ).toEqual( { code: 'flowchart LR' } );
		} );

		it( 'strips the fence lines', () => {
			const { attributes } = transform( [
				para( '```mermaid' ),
				para( 'graph TD' ),
				para( 'A --> B' ),
				para( '```' ),
			] );
			expect( attributes.code ).toBe( 'graph TD\nA --> B' );
			expect( attributes.code ).not.toContain( '```' );
		} );

		it( 'converts <br> tags to newlines', () => {
			const { attributes } = transform( [
				para(
					'```mermaid<br>graph TD<br/>A --> B<BR />C --> D<br>```'
				),
			] );
			expect( attributes.code ).toBe( 'graph TD\nA --> B\nC --> D' );
		} );

		it( 'decodes HTML entities', () => {
			const { attributes } = transform( [
				para( '```mermaid' ),
				para( 'A --&gt; B' ),
				para( '```' ),
			] );
			expect( attributes.code ).toBe( 'A --> B' );
		} );

		it( 'wraps a title: line in front matter', () => {
			const { attributes } = transform( [
				para( '```mermaid' ),
				para( 'title: My diagram' ),
				para( 'flowchart LR' ),
				para( '```' ),
			] );
			expect( attributes.code ).toBe(
				'---\ntitle: My diagram\n---\nflowchart LR'
			);
		} );

		it( 'reads rich text values', () => {
			const { attributes } = transform( [
				richText( '```mermaid' ),
				richText( 'graph TD' ),
				richText( 'A --&gt; B' ),
				richText( '```' ),
			] );
			expect( attributes.code ).toBe( 'graph TD\nA --> B' );
		} );

		it( 'trims the resulting code', () => {
			const { attributes } = transform( [
				para( '  ```mermaid  ' ),
				para( '   graph TD   ' ),
				para( '  ```  ' ),
			] );
			expect( attributes.code ).toBe( attributes.code.trim() );
			expect( attributes.code ).toBe( 'graph TD' );
		} );
	} );
} );

describe( 'transforms.from[1] (Code block marked as Mermaid)', () => {
	const {
		blocks,
		isMatch: isCodeMatch,
		transform: toDiagram,
	} = transforms.from[ 1 ];

	const code = ( html, className = 'language-mermaid' ) => ( {
		...richText( html ),
		className,
	} );

	it( 'is offered for the Code block only', () => {
		expect( blocks ).toEqual( [ 'core/code' ] );
	} );

	describe( 'isMatch', () => {
		it( 'matches a Code block with the class', () => {
			expect( isCodeMatch( code( 'graph TD\nA --&gt; B' ) ) ).toBe(
				true
			);
		} );

		it( 'matches the class among other classes', () => {
			expect(
				isCodeMatch(
					code( 'graph TD', 'is-style-x  language-mermaid' )
				)
			).toBe( true );
		} );

		it.each( [
			[ 'no class', null ],
			[ 'another language', 'language-php' ],
			[ 'the class in a longer one', 'language-mermaid-x' ],
			[ 'a class that is no text', [ 'language-mermaid' ] ],
		] )( 'does not match a Code block with %s', ( _, className ) => {
			expect( isCodeMatch( code( 'graph TD', className ) ) ).toBe(
				false
			);
		} );

		it( 'does not match a Code block without code', () => {
			expect( isCodeMatch( code( '  \n' ) ) ).toBe( false );
			expect( isCodeMatch( { className: 'language-mermaid' } ) ).toBe(
				false
			);
		} );

		it( 'does not throw without attributes', () => {
			expect( isCodeMatch( undefined ) ).toBe( false );
		} );
	} );

	describe( 'transform', () => {
		it( 'creates a diagram block with the decoded code', () => {
			const block = toDiagram(
				code( 'graph TD\n  A --&gt; B{&quot;x &lt; y &amp; z&quot;}\n' )
			);

			expect( block.name ).toBe( 'graphdraw/diagram' );
			expect( block.attributes ).toEqual( {
				code: 'graph TD\n  A --> B{"x < y & z"}',
			} );
		} );

		it( 'reads a plain string too', () => {
			const { attributes } = toDiagram( {
				content: 'graph TD\nA --&gt; B',
				className: 'language-mermaid',
			} );

			expect( attributes.code ).toBe( 'graph TD\nA --> B' );
		} );

		it( 'drops formatting and keeps its text', () => {
			const { attributes } = toDiagram(
				code(
					'<strong>graph</strong> TD\n<a href="#x">A</a> --&gt; <em>B</em>'
				)
			);

			expect( attributes.code ).toBe( 'graph TD\nA --> B' );
		} );

		it( 'keeps a line break in a label, typed or as an element', () => {
			const { attributes } = toDiagram(
				code( 'A[One&lt;br/&gt;Two] --&gt; B[Three<br>Four<BR />Five]' )
			);

			expect( attributes.code ).toBe(
				'A[One<br/>Two] --> B[Three<br/>Four<br/>Five]'
			);
		} );

		it( 'turns non-breaking spaces into spaces', () => {
			const { attributes } = toDiagram(
				code( 'graph TD\n\u00a0\u00a0A --&gt; B' )
			);

			expect( attributes.code ).toBe( 'graph TD\n  A --> B' );
		} );
	} );
} );
