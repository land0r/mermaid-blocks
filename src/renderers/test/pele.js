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

describe( 'the options of the site', () => {
	const spy = () => {
		const module = { ...pele, render: jest.fn( pele.render ) };

		return { module, render: module.render };
	};
	const code = 'flowchart LR\nA --> B';

	it( 'reach render()', async () => {
		const { module, render } = spy();
		const site = { links: true, padding: 12, linkRel: 'nofollow' };

		await createPeleRenderer( module, { measurer, site } ).draw(
			code,
			'auto-light',
			document.body,
			'x'
		);

		expect( render ).toHaveBeenCalledWith(
			code,
			expect.objectContaining( site )
		);
	} );

	it( 'lose to the options the plugin sets', async () => {
		const { module, render } = spy();
		const site = {
			idPrefix: 'site',
			responsive: false,
			fontFamily: 'Site Font',
			fontFamilyMono: 'Site Mono',
			measurer: { width: () => 1 },
			padding: 3,
		};

		const element = document.createElement( 'div' );
		element.style.fontFamily = 'Georgia, serif';
		document.body.appendChild( element );

		await createPeleRenderer( module, { measurer, site } ).draw(
			code,
			'auto-light',
			element,
			'mine'
		);
		element.remove();

		const options = render.mock.calls[ 0 ][ 1 ];

		expect( options ).toMatchObject( {
			idPrefix: 'mine',
			responsive: true,
			fontFamilyMono: 'monospace',
			measurer,
			padding: 3,
		} );
		expect( options.fontFamily ).toBe( 'Georgia, serif' );
	} );

	it( 'leave autoDirection to Pele, unless the site sets it', async () => {
		const { module, render } = spy();

		await createPeleRenderer( module, { measurer } ).draw(
			code,
			'auto-light',
			document.body,
			'x'
		);
		await createPeleRenderer( module, {
			measurer,
			site: { autoDirection: false },
		} ).draw( code, 'auto-light', document.body, 'x' );

		expect( render.mock.calls[ 0 ][ 1 ] ).not.toHaveProperty(
			'autoDirection'
		);
		expect( render.mock.calls[ 1 ][ 1 ].autoDirection ).toBe( false );
	} );

	it( 'leave the defaults when there are none', async () => {
		const { module, render } = spy();

		await createPeleRenderer( module, { measurer } ).draw(
			code,
			'auto-light',
			document.body,
			'x'
		);

		expect( render.mock.calls[ 0 ][ 1 ] ).not.toHaveProperty( 'links' );
	} );
} );

describe( 'the width of the element', () => {
	const code = 'flowchart LR\nA --> B';
	const spy = () => {
		const module = { ...pele, render: jest.fn( pele.render ) };

		return { module, render: module.render };
	};

	/**
	 * Puts an element on the page, which has the width given: jsdom lays
	 * nothing out.
	 *
	 * @param {number} width   Its `clientWidth`.
	 * @param {string} padding Its horizontal padding.
	 */
	const place = ( width, padding = '0' ) => {
		const element = document.createElement( 'div' );

		element.style.padding = `0 ${ padding }`;
		Object.defineProperty( element, 'clientWidth', { value: width } );
		document.body.appendChild( element );

		return element;
	};

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'is the maxWidth, less the padding, and wins over the site', async () => {
		const { module, render } = spy();
		const element = place( 400, '20px' );

		await createPeleRenderer( module, {
			measurer,
			site: { maxWidth: 999 },
		} ).draw( code, 'auto-light', element, 'x' );

		expect( render.mock.calls[ 0 ][ 1 ].maxWidth ).toBe( 360 );
	} );

	it.each( [
		[ 'is not on a page', () => document.createElement( 'div' ) ],
		[ 'has no width', () => place( 0 ) ],
		[ 'is all padding', () => place( 40, '20px' ) ],
	] )( 'gives no maxWidth to an element that %s', async ( name, make ) => {
		const { module, render } = spy();

		await createPeleRenderer( module, {
			measurer,
			site: { maxWidth: 999 },
		} ).draw( code, 'auto-light', make(), 'x' );

		expect( render.mock.calls[ 0 ][ 1 ] ).not.toHaveProperty( 'maxWidth' );
	} );

	it( 'turns a wide flowchart vertical on a narrow element only', async () => {
		const wide =
			'flowchart LR\n' +
			Array.from(
				{ length: 9 },
				( _, i ) => `N${ i } --> N${ i + 1 }`
			).join( '\n' );
		const own = createPeleRenderer( pele, { measurer } );
		const size = async ( element ) => {
			const { svg } = await own.draw( wide, 'auto-light', element, 'x' );
			const [ , , w, h ] = svg
				.match( /viewBox="([^"]+)"/ )[ 1 ]
				.split( ' ' )
				.map( Number );

			return { w, h };
		};

		const full = await size( place( 0 ) );
		const narrow = await size( place( 375 ) );

		expect( full.w ).toBeGreaterThan( full.h );
		expect( narrow.h ).toBeGreaterThan( narrow.w );
	} );
} );

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

		it( 'writes a font with $ and & in it into the SVG as it is', async () => {
			const element = document.createElement( 'div' );
			element.style.fontFamily = '"A $\' B & C", serif';
			document.body.appendChild( element );

			const { svg } = await draw( 'flowchart LR\nA --> B', 'f', element );
			element.remove();

			const template = document.createElement( 'template' );
			template.innerHTML = svg;
			const root = template.content.querySelector( 'svg' );

			expect( root.getAttribute( 'style' ) ).toContain(
				'--pele-font:"A $\' B & C", serif;max-width:100%'
			);
			// Nothing of the SVG ended up in the attribute.
			expect( root.getAttribute( 'style' ) ).not.toContain( '<' );
		} );

		it( 'draws in the fonts of the element variables when set', async () => {
			const element = document.createElement( 'div' );
			element.style.fontFamily = 'Georgia, serif';
			element.style.setProperty( '--pele-font', ' Inter, sans-serif ' );
			element.style.setProperty( '--pele-font-mono', 'Fira Code' );
			document.body.appendChild( element );

			const { svg } = await draw( 'flowchart LR\nA --> B', 'f', element );
			element.remove();

			expect( svg ).toContain( '--pele-font:Inter, sans-serif;' );
			expect( svg ).not.toContain( 'Georgia' );
			expect( svg ).toContain( 'var(--pele-font-mono,Fira Code)' );
		} );

		it( 'falls back to the computed font and to monospace', async () => {
			const element = document.createElement( 'div' );
			element.style.fontFamily = 'Georgia, serif';
			document.body.appendChild( element );

			const { svg } = await draw( 'flowchart LR\nA --> B', 'f', element );
			element.remove();

			expect( svg ).toContain( '--pele-font:Georgia, serif;' );
			expect( svg ).toContain( 'var(--pele-font-mono,monospace)' );
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

		it( 'drops the prefix of a lexical error too, so the line is given once', async () => {
			const code = '---\ntitle: Hi\n---\npie\n"a": 1\n"b": $$x$$';

			const result = await draw( code );

			expect( result.error.line ).toBe( 6 );
			expect( result.error.message ).not.toMatch(
				/^Lexical error on line/
			);
			expect( result.error.message ).toContain( 'Unrecognized text' );
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

		it( 'refuses what the limits of the site refuse, as draw() does', async () => {
			const code = 'flowchart LR\nA --> B\nB --> C\nC --> D';
			const limited = createPeleRenderer( pele, {
				measurer,
				site: { maxEdges: 2 },
			} );

			await expect( renderer.parse( code ) ).resolves.toEqual( {
				type: 'flowchart-v2',
			} );
			expect( ( await limited.parse( code ) ).error ).toBeDefined();
			expect(
				( await limited.draw( code, 'auto-light', document.body, 'x' ) )
					.error
			).toBeDefined();
		} );

		it( 'gives an error and its line', async () => {
			const result = await renderer.parse(
				'flowchart LR\nA --> B\nbad ]]'
			);

			expect( result.error.line ).toBe( 3 );
		} );
	} );
} );

describe( 'math', () => {
	const formula = 'flowchart LR\nA["$$x^2 + y^2 = z^2$$"] --> B';
	const plain = 'flowchart LR\nA --> B';
	const mathModule = jest.requireActual( '../../frontend/math' );
	const drawWith = ( own, code, element = document.body ) =>
		own.draw( code, 'auto-light', element, 'x' );

	// jsdom lays nothing out, and Pele ignores a formula with no size.
	beforeEach( () => {
		jest.spyOn(
			window.Element.prototype,
			'getBoundingClientRect'
		).mockReturnValue( { width: 60, height: 20 } );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
	} );

	it( 'is typeset by the module, loaded once, for code with $$', async () => {
		const loadMath = jest.fn( () => Promise.resolve( mathModule ) );
		const own = createPeleRenderer( pele, { measurer, loadMath } );

		const first = await drawWith( own, formula );
		await drawWith( own, formula );

		expect( first.svg ).toContain( '<math' );
		expect( loadMath ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'is never loaded for code without $$', async () => {
		const loadMath = jest.fn( () => Promise.resolve( mathModule ) );
		const own = createPeleRenderer( pele, { measurer, loadMath } );

		const { svg } = await drawWith( own, plain );

		expect( svg ).not.toContain( '<math' );
		expect( loadMath ).not.toHaveBeenCalled();
	} );

	it( 'shows the source of a formula Temml can not parse', async () => {
		const own = createPeleRenderer( pele, {
			measurer,
			loadMath: () => Promise.resolve( mathModule ),
		} );

		const { svg, error } = await drawWith(
			own,
			'flowchart LR\nA["$$\\frac{a$$"] --> B'
		);

		expect( error ).toBeUndefined();
		expect( svg ).not.toContain( '<math' );
		expect( svg ).toContain( 'frac' );
	} );

	it( 'is measured in the document of the diagram', async () => {
		const other = document.implementation.createHTMLDocument( '' );
		const element = other.createElement( 'div' );
		const typeset = jest.fn( () => null );
		const own = createPeleRenderer( pele, {
			measurer,
			loadMath: () => Promise.resolve( { typeset } ),
		} );

		other.body.appendChild( element );
		await drawWith( own, formula, element );

		expect( typeset ).toHaveBeenCalledWith(
			'x^2 + y^2 = z^2',
			expect.any( Number ),
			other
		);
	} );

	it( 'wins over a resolver in the options of the site', async () => {
		const site = { math: jest.fn() };
		const own = createPeleRenderer( pele, {
			measurer,
			site,
			loadMath: () => Promise.resolve( mathModule ),
		} );

		const { svg } = await drawWith( own, formula );

		expect( svg ).toContain( '<math' );
		expect( site.math ).not.toHaveBeenCalled();
	} );

	it( 'is left out, and the error logged, when the module fails to load', async () => {
		const error = jest.spyOn( console, 'error' ).mockImplementation();
		const own = createPeleRenderer( pele, {
			measurer,
			loadMath: () => Promise.reject( new Error( 'offline' ) ),
		} );

		const result = await drawWith( own, formula );

		expect( result.error ).toBeUndefined();
		expect( result.svg ).not.toContain( '<math' );
		expect( error ).toHaveBeenCalledTimes( 1 );

		error.mockRestore();
	} );
} );

describe( 'icons', () => {
	const fa = {
		prefix: 'fa',
		width: 512,
		height: 512,
		icons: {
			car: { body: '<path id="car"/>' },
			user: { body: '<path id="user"/>' },
		},
	};
	const logos = {
		prefix: 'logos',
		icons: { aws: { body: '<g id="aws"/>' } },
	};
	const label = 'flowchart LR\nA["fa:fa-car Car"] --> B["fa:fa-github Hub"]';
	const shape = 'flowchart LR\nA@{ icon: "fa:user", label: "User" }';
	const architecture =
		'architecture-beta\nservice a(logos:aws)[AWS]\nservice d(database)[DB]\na:R -- L:d';
	let n = 0;
	let packs;

	const spy = () => {
		const module = { ...pele, render: jest.fn( pele.render ) };

		return { module, render: module.render };
	};
	const make = ( module = pele, extra = {} ) =>
		createPeleRenderer( module, {
			measurer,
			iconPacks: { fa: `/fa-${ n }.json`, logos: `/logos-${ n }.json` },
			...extra,
		} );
	const drawWith = ( own, code ) =>
		own.draw( code, 'auto-light', document.body, 'x' );

	beforeEach( () => {
		n++;
		packs = { [ `/fa-${ n }.json` ]: fa, [ `/logos-${ n }.json` ]: logos };
		global.fetch = jest.fn( ( url ) =>
			Promise.resolve( {
				ok: true,
				json: () => Promise.resolve( packs[ url ] ),
			} )
		);
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete global.fetch;
	} );

	it( 'draws the icon of a label, with the pack fetched for it', async () => {
		const { svg } = await drawWith( make(), label );

		expect( svg ).toContain( 'data-icon="fa:fa-car"' );
		expect( svg ).toContain( '<path id="car"/>' );
		expect( svg ).toMatch( /<svg[^>]*viewBox="0 0 512 512"/ );
	} );

	it( 'draws an icon shape and an architecture icon', async () => {
		expect( ( await drawWith( make(), shape ) ).svg ).toContain(
			'<path id="user"/>'
		);

		const { svg } = await drawWith( make(), architecture );

		expect( svg ).toContain( '<g id="aws"/>' );
		// The built-in symbol is Pele's own.
		expect( svg ).toContain( 'data-icon="database"' );
	} );

	it( 'draws again only when a pack had to be loaded', async () => {
		const { module, render } = spy();
		const own = make( module );

		await drawWith( own, label );
		expect( render ).toHaveBeenCalledTimes( 2 );

		await drawWith( own, shape );
		expect( render ).toHaveBeenCalledTimes( 3 );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'fetches nothing for a diagram that names no icon of a pack', async () => {
		const { module, render } = spy();

		await drawWith( make( module ), 'flowchart LR\nA --> B' );
		await drawWith(
			make( module ),
			'architecture-beta\nservice d(database)[DB]'
		);

		expect( global.fetch ).not.toHaveBeenCalled();
		expect( render ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'draws without the icons the packs lack', async () => {
		const { svg } = await drawWith( make(), label );

		// `github` is not in the pack: its label is drawn, with no icon.
		expect( svg ).toContain( 'Hub' );
		expect( svg ).not.toContain( 'data-icon="fa:fa-github"' );
	} );

	it( 'draws without icons when a pack fails to load', async () => {
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		global.fetch = jest.fn( () =>
			Promise.reject( new Error( 'offline' ) )
		);

		const result = await drawWith( make(), label );

		expect( result.error ).toBeUndefined();
		expect( result.svg ).toContain( 'Car' );
		expect( result.svg ).not.toContain( 'data-icon' );
	} );

	it( 'never puts a name from the diagram into markup', async () => {
		packs[ `/fa-${ n }.json` ] = {
			icons: { x: { body: '<path/>' } },
		};

		const { svg } = await drawWith(
			make(),
			'flowchart LR\nA@{ icon: "fa:<script>alert(1)</script>", label: "L" }'
		);

		expect( svg ).not.toContain( '<script>' );
	} );

	it( 'passes no resolver without packs, and wins over the site', async () => {
		const { module, render } = spy();
		const mine = make( module, { iconPacks: undefined } );

		await drawWith( mine, label );
		expect( render.mock.calls[ 0 ][ 1 ].icons ).toBeUndefined();

		const site = { icons: () => '<g id="site"/>' };
		const { svg } = await drawWith( make( module, { site } ), label );

		expect( svg ).not.toContain( 'id="site"' );
	} );
} );

describe( 'enableZoom()', () => {
	it( "enables Pele's zoom on an element, with the labels", async () => {
		const element = document.createElement( 'div' );
		document.body.append( element );
		element.innerHTML = ( await draw( 'flowchart LR\nA --> B' ) ).svg;

		const zoom = renderer.enableZoom( element, {
			always: true,
			labels: { zoomIn: 'In', zoomOut: 'Out', reset: 'Back' },
		} );

		expect(
			Array.from( element.querySelectorAll( 'button' ) ).map(
				( button ) => button.getAttribute( 'aria-label' )
			)
		).toEqual( [ 'In', 'Out', 'Back' ] );
		expect( typeof zoom.refresh ).toBe( 'function' );

		zoom.destroy();
	} );
} );
