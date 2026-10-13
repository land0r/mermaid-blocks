import {
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

describe( 'downloadDiagram', () => {
	let downloads;
	let context;
	let pngBlob;

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

	beforeEach( () => {
		downloads = [];
		context = { fillRect: jest.fn(), drawImage: jest.fn() };
		pngBlob = new window.Blob( [ 'png' ], { type: 'image/png' } );
		FakeImage.fails = false;
		FakeImage.loaded = [];

		window.Image = FakeImage;
		window.URL.createObjectURL = jest.fn( () => 'blob:diagram' );
		window.URL.revokeObjectURL = jest.fn();

		jest.spyOn(
			window.HTMLAnchorElement.prototype,
			'click'
		).mockImplementation( function () {
			downloads.push( { name: this.download, url: this.href } );
		} );
		jest.spyOn(
			window.HTMLCanvasElement.prototype,
			'getContext'
		).mockImplementation( () => context );
		jest.spyOn(
			window.HTMLCanvasElement.prototype,
			'toBlob'
		).mockImplementation( ( callback ) => callback( pngBlob ) );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete window.URL.createObjectURL;
		delete window.URL.revokeObjectURL;
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
