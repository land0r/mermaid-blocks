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

		it.todo( 'does not throw for blocks without a content attribute (#6)' );
	} );

	describe( 'transform', () => {
		it( 'creates a mermaid-blocks/diagram block', () => {
			const block = transform( [
				para( '```mermaid' ),
				para( 'flowchart LR' ),
				para( '```' ),
			] );
			expect( block.name ).toBe( 'mermaid-blocks/diagram' );
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
