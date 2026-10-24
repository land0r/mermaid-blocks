// eslint-disable-next-line import/no-unresolved
import * as pele from 'pele/lazy';

import { createPeleRenderer } from '../../renderers/pele';
import { DARK, LIGHT, PALETTES, getPaletteVariables } from '../pele-palette';
import {
	canCopyImage,
	copyDiagram,
	downloadDiagram,
	getDiagramSize,
	getPngBackground,
	getPngBlob,
	getPngSize,
	getSvgMarkup,
	getThemeBackground,
} from '../export-diagram';

// A diagram as Mermaid renders it: as wide as the page allows, with a label
// in HTML.
const DIAGRAM =
	'<svg id="diagram-1" width="100%" viewBox="0 0 300 150.5" style="max-width: 300px; background-color: white;" xmlns="http://www.w3.org/2000/svg">' +
	'<style>#diagram-1 .node > rect { fill: #eee; }</style>' +
	'<foreignObject width="100" height="24"><div><span>a &amp; b<br>c</span></div></foreignObject>' +
	'</svg>';

function createDiagram( markup = DIAGRAM ) {
	document.body.innerHTML = markup;

	return document.body.firstElementChild;
}

// Another diagram, 1000 pixels wide, on the page.
function createWide() {
	const wrapper = document.createElement( 'div' );

	wrapper.innerHTML = '<svg viewBox="0 0 1000 100"></svg>';
	document.body.appendChild( wrapper );

	return wrapper.firstElementChild;
}

const parse = ( markup ) =>
	new window.DOMParser().parseFromString( markup, 'image/svg+xml' );

describe( 'getDiagramSize', () => {
	it( 'reads the size from the viewBox', () => {
		expect( getDiagramSize( createDiagram() ) ).toEqual( {
			width: 300,
			height: 150.5,
		} );
	} );

	it( 'accepts a viewBox separated by commas', () => {
		const svg = createDiagram( '<svg viewBox="0,0, 40,20"></svg>' );

		expect( getDiagramSize( svg ) ).toEqual( { width: 40, height: 20 } );
	} );

	it( 'falls back to the size on the page', () => {
		const svg = createDiagram( '<svg width="80" height="60"></svg>' );
		svg.getBoundingClientRect = () => ( { width: 80, height: 60 } );

		expect( getDiagramSize( svg ) ).toEqual( { width: 80, height: 60 } );
	} );
} );

describe( 'getPngSize', () => {
	it( 'doubles a diagram of an ordinary size', () => {
		expect( getPngSize( { width: 800, height: 600.4 } ) ).toEqual( {
			width: 1600,
			height: 1200,
		} );
	} );

	it( 'keeps a large diagram within the pixels a browser can draw', () => {
		const { width, height } = getPngSize( { width: 6000, height: 4000 } );

		expect( width * height ).toBeLessThanOrEqual( 16777216 );
		expect( width * height ).toBeGreaterThan( 16000000 );
		expect( width / height ).toBeCloseTo( 1.5, 2 );
	} );

	it( 'keeps a long diagram within the longest side a browser can draw', () => {
		expect( getPngSize( { width: 30000, height: 100 } ) ).toEqual( {
			width: 16384,
			height: 54,
		} );
	} );
} );

describe( 'getPngBackground', () => {
	const PLAIN = '<svg viewBox="0 0 300 150"></svg>';

	it( 'is white for a diagram on a light surface', () => {
		expect( getPngBackground( createDiagram( PLAIN ) ) ).toBe( '#fff' );

		const section = createDiagram(
			`<section style="background-color: rgb(249, 246, 238)">${ PLAIN }</section>`
		);

		expect( getPngBackground( section.firstElementChild ) ).toBe( '#fff' );
	} );

	it( 'is the colour of a dark surface, which the diagram is drawn for', () => {
		const section = createDiagram(
			`<section style="background-color: rgb(17, 24, 39)">${ PLAIN }</section>`
		);

		expect( getPngBackground( section.firstElementChild ) ).toBe(
			'rgb(17, 24, 39)'
		);
	} );

	it( 'is dark for a diagram on a dark surface of an unknown colour', () => {
		const section = createDiagram(
			'<section style="background-image: url(photo.jpg)"><svg viewBox="0 0 300 150" style="color: rgb(241, 245, 249)"></svg></section>'
		);

		expect( getPngBackground( section.firstElementChild ) ).toBe( '#333' );
	} );
} );

describe( 'getThemeBackground', () => {
	it( 'is white for a light theme, and for what Mermaid picks', () => {
		expect( getThemeBackground( 'forest' ) ).toBe( '#fff' );
		expect( getThemeBackground( 'auto-light' ) ).toBe( '#fff' );
	} );

	it( 'is dark for a dark theme, which has light text', () => {
		expect( getThemeBackground( 'dark' ) ).toBe( '#333' );
		expect( getThemeBackground( 'redux-dark-color' ) ).toBe( '#333' );
		expect( getThemeBackground( 'auto-dark' ) ).toBe( '#333' );
	} );
} );

describe( 'getSvgMarkup', () => {
	it( 'states the size of the diagram instead of following the page', () => {
		const svg = parse( getSvgMarkup( createDiagram() ) ).documentElement;

		expect( svg.getAttribute( 'width' ) ).toBe( '300' );
		expect( svg.getAttribute( 'height' ) ).toBe( '150.5' );
		expect( svg.style.maxWidth ).toBe( '' );
		expect( svg.style.backgroundColor ).toBe( 'white' );
	} );

	it( 'ignores the zoom', () => {
		const diagram = createDiagram();
		diagram.style.width = '900px';
		diagram.style.maxWidth = 'none';

		const svg = parse( getSvgMarkup( diagram ) ).documentElement;

		expect( svg.getAttribute( 'width' ) ).toBe( '300' );
		expect( svg.style.width ).toBe( '' );
	} );

	it( 'enlarges the diagram by a scale', () => {
		const svg = parse( getSvgMarkup( createDiagram(), 2 ) ).documentElement;

		expect( svg.getAttribute( 'width' ) ).toBe( '600' );
		expect( svg.getAttribute( 'height' ) ).toBe( '301' );
		expect( svg.getAttribute( 'viewBox' ) ).toBe( '0 0 300 150.5' );
	} );

	it( 'gives a diagram without a viewBox one, so it can be enlarged', () => {
		const diagram = createDiagram( '<svg width="80" height="60"></svg>' );
		diagram.getBoundingClientRect = () => ( { width: 80, height: 60 } );

		const svg = parse( getSvgMarkup( diagram, 2 ) ).documentElement;

		expect( svg.getAttribute( 'viewBox' ) ).toBe( '0 0 80 60' );
		expect( svg.getAttribute( 'width' ) ).toBe( '160' );
	} );

	it( 'is a well-formed document, HTML labels included', () => {
		const markup = getSvgMarkup( createDiagram() );
		const doc = parse( markup );

		expect( markup.startsWith( '<?xml version="1.0"' ) ).toBe( true );
		expect( doc.querySelector( 'parsererror' ) ).toBeNull();
		expect( doc.querySelector( 'span' ).textContent ).toBe( 'a & bc' );
		expect( doc.querySelector( 'style' ).textContent ).toContain(
			'.node > rect'
		);
	} );

	it( 'leaves the diagram on the page untouched', () => {
		const diagram = createDiagram();
		const before = diagram.outerHTML;

		getSvgMarkup( diagram, 2 );

		expect( diagram.outerHTML ).toBe( before );
	} );
} );

// Stands in for the browser loading the SVG as an image.
class FakeImage {
	static fails = false;
	static loaded = [];

	set src( url ) {
		FakeImage.loaded.push( url );
		setTimeout( () =>
			FakeImage.fails ? this.onerror() : this.onload()
		);
	}
}

/**
 * Stands in for what drawing a PNG and downloading a file need, before each
 * test of the calling `describe`.
 *
 * @return {Object} The downloads started, the canvas context and the PNG, as
 * properties set before each test.
 */
function setUpPng() {
	const state = {};

	beforeEach( () => {
		state.downloads = [];
		state.context = { fillRect: jest.fn(), drawImage: jest.fn() };
		state.pngBlob = new window.Blob( [ 'png' ], { type: 'image/png' } );
		FakeImage.fails = false;
		FakeImage.loaded = [];

		window.Image = FakeImage;
		window.URL.createObjectURL = jest.fn( () => 'blob:diagram' );
		window.URL.revokeObjectURL = jest.fn();

		jest.spyOn(
			window.HTMLAnchorElement.prototype,
			'click'
		).mockImplementation( function () {
			state.downloads.push( { name: this.download, url: this.href } );
		} );
		jest.spyOn(
			window.HTMLCanvasElement.prototype,
			'getContext'
		).mockImplementation( () => state.context );
		jest.spyOn(
			window.HTMLCanvasElement.prototype,
			'toBlob'
		).mockImplementation( ( callback ) => callback( state.pngBlob ) );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete window.URL.createObjectURL;
		delete window.URL.revokeObjectURL;
	} );

	return state;
}

describe( 'downloadDiagram', () => {
	const png = setUpPng();
	let downloads;
	let context;
	let pngBlob;

	beforeEach( () => {
		( { downloads, context, pngBlob } = png );
	} );

	it( 'downloads the SVG', async () => {
		await downloadDiagram( createDiagram(), 'svg' );

		const [ blob ] = window.URL.createObjectURL.mock.calls[ 0 ];

		expect( blob.type ).toBe( 'image/svg+xml;charset=utf-8' );
		expect( downloads ).toEqual( [
			{ name: 'mermaid-diagram.svg', url: 'blob:diagram' },
		] );
		expect( document.querySelector( 'a' ) ).toBeNull();
	} );

	it( 'makes the file from the diagram it is given instead, when it is given a way', async () => {
		const made = jest.fn( ( use ) => use( createWide() ) );

		await downloadDiagram( createDiagram(), 'png', made );

		const [ , , , width, height ] = png.context.drawImage.mock.calls[ 0 ];

		expect( made ).toHaveBeenCalledTimes( 1 );
		expect( [ width, height ] ).toEqual( [ 2000, 200 ] );
	} );

	it( 'downloads a PNG twice the size, on a white background', async () => {
		await downloadDiagram( createDiagram(), 'png' );

		const [ image, , , width, height ] = context.drawImage.mock.calls[ 0 ];

		expect( image ).toBeInstanceOf( FakeImage );
		expect( [ width, height ] ).toEqual( [ 600, 301 ] );
		expect( context.fillStyle ).toBe( '#fff' );
		expect( context.fillRect ).toHaveBeenCalledWith( 0, 0, 600, 301 );
		expect( window.URL.createObjectURL ).toHaveBeenCalledWith( pngBlob );
		expect( downloads[ 0 ].name ).toBe( 'mermaid-diagram.png' );
	} );

	it( 'gives the PNG of a diagram on a dark surface the colour of that surface', async () => {
		const section = createDiagram(
			'<section style="background-color: rgb(17, 24, 39)"><svg viewBox="0 0 300 150"></svg></section>'
		);

		await downloadDiagram( section.firstElementChild, 'png' );

		expect( context.fillStyle ).toBe( 'rgb(17, 24, 39)' );
		expect( context.fillRect ).toHaveBeenCalledWith( 0, 0, 600, 300 );
	} );

	it( 'draws the PNG from an SVG of the same size, in a data URL', async () => {
		await downloadDiagram( createDiagram(), 'png' );

		const [ url ] = FakeImage.loaded;
		const prefix = 'data:image/svg+xml;charset=utf-8,';
		const svg = parse(
			decodeURIComponent( url.slice( prefix.length ) )
		).documentElement;

		expect( url.startsWith( prefix ) ).toBe( true );
		expect( svg.getAttribute( 'width' ) ).toBe( '600' );
	} );

	it( 'draws a diagram that is in no page on the background it is given', async () => {
		const template = document.createElement( 'template' );
		template.innerHTML = DIAGRAM;
		document.body.innerHTML =
			'<section style="background-color: rgb(17, 24, 39)"></section>';

		const blob = await getPngBlob(
			template.content.firstElementChild,
			'#333'
		);

		expect( blob ).toBe( pngBlob );
		expect( context.fillStyle ).toBe( '#333' );
		expect( context.fillRect ).toHaveBeenCalledWith( 0, 0, 600, 301 );
		expect( downloads ).toEqual( [] );
	} );

	it( 'rejects when the browser cannot load the diagram as an image', async () => {
		FakeImage.fails = true;

		await expect(
			downloadDiagram( createDiagram(), 'png' )
		).rejects.toThrow();
		expect( downloads ).toEqual( [] );
	} );

	it( 'rejects when the browser cannot create the PNG', async () => {
		window.HTMLCanvasElement.prototype.toBlob.mockImplementation(
			( callback ) => callback( null )
		);

		await expect(
			downloadDiagram( createDiagram(), 'png' )
		).rejects.toThrow();
		expect( downloads ).toEqual( [] );
	} );
} );

describe( 'canCopyImage', () => {
	const view = ( { ClipboardItem, clipboard } ) => ( {
		ClipboardItem,
		navigator: { clipboard },
	} );

	it( 'is true where the clipboard takes images', () => {
		expect(
			canCopyImage(
				view( {
					ClipboardItem: class {},
					clipboard: { write: () => {} },
				} )
			)
		).toBe( true );
	} );

	it( 'is false without a clipboard, as on a page served over HTTP', () => {
		expect( canCopyImage( view( { ClipboardItem: class {} } ) ) ).toBe(
			false
		);
	} );

	it( 'is false where the clipboard takes only text', () => {
		expect(
			canCopyImage( view( { clipboard: { writeText: () => {} } } ) )
		).toBe( false );
	} );
} );

describe( 'copyDiagram', () => {
	const png = setUpPng();
	let written;

	// Stands in for the browser's ClipboardItem.
	class FakeClipboardItem {
		constructor( items ) {
			this.items = items;
		}
	}

	beforeEach( () => {
		written = null;
		window.ClipboardItem = FakeClipboardItem;
		Object.defineProperty( window.navigator, 'clipboard', {
			configurable: true,
			value: {
				write: jest.fn( async ( [ item ] ) => {
					// The browser reads the PNG once it has been drawn.
					written = await item.items[ 'image/png' ];
				} ),
			},
		} );
	} );

	afterEach( () => {
		delete window.ClipboardItem;
		delete window.navigator.clipboard;
	} );

	it( 'puts the PNG the download makes on the clipboard', async () => {
		await copyDiagram( createDiagram() );

		expect( written ).toBe( png.pngBlob );
		expect( png.context.fillStyle ).toBe( '#fff' );
		expect( png.context.fillRect ).toHaveBeenCalledWith( 0, 0, 600, 301 );
		expect( png.downloads ).toEqual( [] );
	} );

	it( 'copies the diagram it is given a way to, in place of the one on the page', async () => {
		await copyDiagram( createDiagram(), ( use ) => use( createWide() ) );

		expect( png.context.fillRect ).toHaveBeenCalledWith( 0, 0, 2000, 200 );
	} );

	it( 'writes to the clipboard before the PNG has been drawn', async () => {
		const copied = copyDiagram( createDiagram() );

		const [ [ [ item ] ] ] = window.navigator.clipboard.write.mock.calls;

		expect( item ).toBeInstanceOf( FakeClipboardItem );
		expect( item.items[ 'image/png' ] ).toBeInstanceOf( Promise );

		await copied;
	} );

	it( 'rejects when the PNG cannot be created', async () => {
		window.HTMLCanvasElement.prototype.toBlob.mockImplementation(
			( callback ) => callback( null )
		);

		await expect( copyDiagram( createDiagram() ) ).rejects.toThrow();
	} );
} );

describe( 'a Pele diagram', () => {
	const png = setUpPng();

	// jsdom has no canvas, so the text is measured by an estimate.
	const renderer = createPeleRenderer( pele, {
		measurer: { width: ( text, size ) => text.length * size * 0.55 },
	} );

	/**
	 * Puts CSS variables on an element, as the front end puts a palette on
	 * the canvas of a diagram.
	 *
	 * @param {Element}                element   The element.
	 * @param {Object<string, string>} variables The value of each variable.
	 */
	const setVariables = ( element, variables ) =>
		Object.entries( variables ).forEach( ( [ name, value ] ) =>
			element.style.setProperty( name, value )
		);

	/**
	 * Draws a diagram with Pele into a canvas on the page, with a palette, as
	 * the front end does.
	 *
	 * @param {string} palette LIGHT or DARK.
	 * @param {string} [code]  The Mermaid source.
	 *
	 * @return {SVGSVGElement} The SVG on the page.
	 */
	async function drawPele(
		palette,
		code = 'flowchart LR\nA --> B\nB --> C'
	) {
		document.body.innerHTML =
			'<div class="canvas" style="font-family: Georgia, serif"></div>';

		const canvas = document.body.firstElementChild;
		const { svg } = await renderer.draw( code, 'auto-light', canvas, 'p1' );

		canvas.innerHTML = svg;
		setVariables( canvas, getPaletteVariables( palette, null ) );

		return canvas.querySelector( 'svg' );
	}

	it( 'comes out with the dark colours it was drawn in, and its font', async () => {
		const svg = await drawPele( DARK );

		const markup = getSvgMarkup( svg );

		expect( markup ).not.toMatch( /var\(/ );
		expect( markup ).not.toContain( '--pele' );
		expect( markup ).not.toContain( '--_' );
		expect( markup ).toContain( PALETTES[ DARK ][ '--pele-fg' ] );
		expect( markup ).toContain( PALETTES[ DARK ][ '--pele-surface' ] );
		expect( markup ).toContain( PALETTES[ DARK ][ '--pele-border' ] );
		expect( markup ).toContain( 'Georgia' );
		expect( markup ).not.toContain( PALETTES[ LIGHT ][ '--pele-fg' ] );
		expect( parse( markup ).querySelector( 'parsererror' ) ).toBeNull();
	} );

	it( 'comes out with the light colours of a light diagram', async () => {
		const markup = getSvgMarkup( await drawPele( LIGHT ) );

		expect( markup ).not.toMatch( /var\(/ );
		expect( markup ).toContain( PALETTES[ LIGHT ][ '--pele-surface' ] );
		expect( markup ).not.toContain( PALETTES[ DARK ][ '--pele-surface' ] );
	} );

	it( 'gets the series colours of a chart', async () => {
		const markup = getSvgMarkup(
			await drawPele( DARK, 'pie\n"a": 1\n"b": 2' )
		);

		expect( markup ).not.toMatch( /var\(/ );
		expect( markup ).toContain( PALETTES[ DARK ][ '--pele-series-1' ] );
		expect( markup ).toContain( PALETTES[ DARK ][ '--pele-series-2' ] );
	} );

	it( 'falls back to the light colours where the page sets none', async () => {
		const svg = await drawPele( LIGHT );
		svg.parentElement.removeAttribute( 'style' );

		const markup = getSvgMarkup( svg );

		expect( markup ).not.toMatch( /var\(/ );
		expect( markup ).toContain( '#f3f3f3' );
	} );

	it( 'takes the values on its own style, for a diagram that is not on a page', async () => {
		const svg = await drawPele( LIGHT );
		const template = document.createElement( 'template' );
		template.innerHTML = svg.outerHTML;
		const detached = template.content.querySelector( 'svg' );
		setVariables( detached, PALETTES[ DARK ] );

		const markup = getSvgMarkup( detached );

		expect( markup ).not.toMatch( /var\(/ );
		expect( markup ).not.toContain( '--pele' );
		expect( markup ).toContain( PALETTES[ DARK ][ '--pele-fg' ] );
		expect( getPngBackground( detached ) ).toBe(
			PALETTES[ DARK ][ '--pele-bg' ]
		);
	} );

	it( 'leaves the diagram on the page untouched', async () => {
		const svg = await drawPele( DARK );
		const before = svg.outerHTML;

		getSvgMarkup( svg, 2 );

		expect( svg.outerHTML ).toBe( before );
	} );

	it( 'states its size, like any other diagram', async () => {
		const svg = await drawPele( DARK );
		const { width, height } = getDiagramSize( svg );

		const file = parse( getSvgMarkup( svg ) ).documentElement;

		expect( file.getAttribute( 'width' ) ).toBe( String( width ) );
		expect( file.getAttribute( 'height' ) ).toBe( String( height ) );
		expect( file.style.maxWidth ).toBe( '' );
	} );

	it( 'gets a PNG background that matches its palette', async () => {
		expect( getPngBackground( await drawPele( DARK ) ) ).toBe(
			PALETTES[ DARK ][ '--pele-bg' ]
		);
		expect( getPngBackground( await drawPele( LIGHT ) ) ).toBe(
			PALETTES[ LIGHT ][ '--pele-bg' ]
		);
	} );

	it( 'gets the colour of the surface it was drawn on as the PNG background', async () => {
		const svg = await drawPele( DARK );
		setVariables(
			svg.parentElement,
			getPaletteVariables( DARK, {
				isDark: true,
				color: 'rgb(17, 24, 39)',
			} )
		);

		expect( getPngBackground( svg ) ).toBe( 'rgb(17, 24, 39)' );
	} );

	it( 'is downloaded as a PNG drawn from the SVG with the colours, on that background', async () => {
		const svg = await drawPele( DARK );

		await downloadDiagram( svg, 'png' );

		const [ url ] = FakeImage.loaded;
		const markup = decodeURIComponent( url.split( ',' )[ 1 ] );

		expect( markup ).not.toMatch( /var\(/ );
		expect( markup ).toContain( PALETTES[ DARK ][ '--pele-fg' ] );
		expect( png.context.fillStyle ).toBe( PALETTES[ DARK ][ '--pele-bg' ] );
	} );

	it( 'is downloaded as an SVG file with the colours', async () => {
		await downloadDiagram( await drawPele( DARK ), 'svg' );

		const [ blob ] = window.URL.createObjectURL.mock.calls[ 0 ];
		const text = await new Promise( ( resolve ) => {
			const reader = new window.FileReader();
			reader.onload = () => resolve( reader.result );
			reader.readAsText( blob );
		} );

		expect( text ).not.toMatch( /var\(/ );
		expect( text ).toContain( PALETTES[ DARK ][ '--pele-fg' ] );
	} );

	it( 'leaves a Mermaid.js diagram as it was', () => {
		const svg = createDiagram(
			DIAGRAM.replace( 'style="', 'style="--pele-fg: red; ' )
		);

		expect( getSvgMarkup( svg ) ).toContain( 'xmlns' );
		expect( getPngBackground( svg ) ).toBe( '#fff' );
	} );
} );
