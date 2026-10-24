/**
 * Turns a rendered diagram into a file: the SVG itself, or a PNG drawn from
 * it. Used by the download buttons on the front end and in the editor, and by
 * the editor's Copy as PNG.
 */
import { getSurface } from './surface';
import { isDarkTheme } from './themes';

const FILE_NAME = 'mermaid-diagram';

// A PNG has twice the diagram's size, to stay sharp on dense screens, unless
// that takes more pixels than every browser can draw.
const PNG_SCALE = 2;
const PNG_MAX_AREA = 16777216;
const PNG_MAX_SIDE = 16384;

// The background of a PNG. A diagram is transparent, and a PNG can land
// anywhere: it brings a background its text can be read on.
const PNG_BACKGROUND = '#fff';
const PNG_DARK_BACKGROUND = '#333';

// How long a download may take to start before its data is released.
const RELEASE_DELAY = 40000;

/**
 * Returns the size a diagram was drawn at, which is the size of its `viewBox`.
 * The size on the page says nothing: it follows the page's width and the zoom.
 *
 * @param {SVGSVGElement} svg The rendered diagram.
 *
 * @return {{width: number, height: number}} The size, in pixels.
 */
export function getDiagramSize( svg ) {
	const [ , , width, height ] = ( svg.getAttribute( 'viewBox' ) || '' )
		.trim()
		.split( /[\s,]+/ )
		.map( Number );

	if ( width > 0 && height > 0 ) {
		return { width, height };
	}

	const rect = svg.getBoundingClientRect();

	return { width: rect.width, height: rect.height };
}

/**
 * Returns the size of the PNG of a diagram.
 *
 * @param {{width: number, height: number}} size The diagram's size.
 *
 * @return {{width: number, height: number}} The PNG's size, in whole pixels:
 * PNG_SCALE times the diagram's, or less for a very large diagram.
 */
export function getPngSize( { width, height } ) {
	const scale = Math.min(
		PNG_SCALE,
		Math.sqrt( PNG_MAX_AREA / ( width * height ) ),
		PNG_MAX_SIDE / Math.max( width, height )
	);

	return {
		width: Math.floor( width * scale ),
		height: Math.floor( height * scale ),
	};
}

/**
 * Tells whether a diagram was drawn by Pele, whose colours and font are CSS
 * variables of the page.
 *
 * @param {SVGSVGElement} svg The rendered diagram.
 *
 * @return {boolean} Whether it was.
 */
function isPele( svg ) {
	return svg.classList.contains( 'pele' );
}

/**
 * Reads the value a CSS variable has for a diagram: as computed on it, which
 * includes the palette on its canvas and what a stylesheet of the site sets.
 * A diagram that isn't on a page has its values on its own style.
 *
 * @param {SVGSVGElement} svg  The rendered diagram.
 * @param {string}        name The name of the variable.
 *
 * @return {string} The value, or an empty string when it has none.
 */
function readVariable( svg, name ) {
	const view = svg.ownerDocument.defaultView;
	const computed = view
		? view.getComputedStyle( svg ).getPropertyValue( name ).trim()
		: '';

	if ( computed ) {
		return computed;
	}

	// Where styles aren't computed through inheritance: the nearest element
	// that sets it.
	for ( let node = svg; node; node = node.parentElement ) {
		const value = node.style && node.style.getPropertyValue( name ).trim();

		if ( value ) {
			return value;
		}
	}

	return '';
}

/**
 * Replaces each `var()` in a CSS value by what it stands for, or by its
 * fallback.
 *
 * @param {string}   value  The value, such as `var(--pele-fg, #1f1f1f)`.
 * @param {Function} lookup Given the name of a variable, returns its value, or
 *                          a falsy value when it has none.
 *
 * @return {string} The value, with no variable left.
 */
function replaceVariables( value, lookup ) {
	let result = '';
	let index = 0;
	let start = value.indexOf( 'var(' );

	while ( start !== -1 ) {
		let depth = 0;
		let end = -1;

		for ( let position = start + 3; position < value.length; position++ ) {
			if ( value[ position ] === '(' ) {
				depth += 1;
			} else if ( value[ position ] === ')' ) {
				depth -= 1;

				if ( depth === 0 ) {
					end = position;
					break;
				}
			}
		}

		if ( end === -1 ) {
			break;
		}

		const inner = value.slice( start + 4, end );
		const comma = inner.indexOf( ',' );
		const name = ( comma === -1 ? inner : inner.slice( 0, comma ) ).trim();
		const fallback = comma === -1 ? '' : inner.slice( comma + 1 ).trim();

		result +=
			value.slice( index, start ) +
			replaceVariables( lookup( name ) || fallback, lookup );
		index = end + 1;
		start = value.indexOf( 'var(', index );
	}

	return result + value.slice( index );
}

/**
 * Writes the colours and the font a Pele diagram was drawn with into a copy of
 * it, in place of the CSS variables it asks the page for: a file has no page
 * to take them from.
 *
 * @param {SVGSVGElement} svg  The diagram, which has the values.
 * @param {SVGSVGElement} copy The copy of the diagram.
 */
function writePeleVariables( svg, copy ) {
	// A diagram has a few variables, which its elements refer to many times.
	const values = new Map();
	const lookup = ( name ) => {
		if ( ! values.has( name ) ) {
			values.set( name, readVariable( svg, name ) );
		}

		return values.get( name );
	};

	[ copy, ...copy.querySelectorAll( '*' ) ].forEach( ( element ) => {
		Array.from( element.attributes ).forEach( ( { name, value } ) => {
			if ( value.includes( 'var(' ) ) {
				element.setAttribute( name, replaceVariables( value, lookup ) );
			}
		} );

		if (
			element.localName === 'style' &&
			element.textContent.includes( 'var(' )
		) {
			element.textContent = replaceVariables(
				element.textContent,
				lookup
			);
		}
	} );

	// Nothing refers to the variables now.
	const rules = ( copy.getAttribute( 'style' ) || '' )
		.split( ';' )
		.filter( ( rule ) => rule.trim() && ! rule.trim().startsWith( '--' ) );

	copy.setAttribute( 'style', rules.join( ';' ) );
}

/**
 * Returns a diagram as the content of a standalone SVG file.
 *
 * On the page the diagram is as wide as the page allows (`width="100%"`),
 * which only a browser understands. The file states its size instead, so it
 * opens at that size anywhere.
 *
 * A Pele diagram takes its colours and its font from CSS variables of the
 * page, so the file gets the values the diagram has on the page, or on its own
 * style for one that isn't on a page, and no variable is left in it.
 *
 * @param {SVGSVGElement} svg     The rendered diagram. It is left untouched.
 * @param {number}        [scale] How much to enlarge the diagram.
 *
 * @return {string} The SVG document.
 */
export function getSvgMarkup( svg, scale = 1 ) {
	const { width, height } = getDiagramSize( svg );
	const copy = svg.cloneNode( true );

	if ( isPele( svg ) ) {
		writePeleVariables( svg, copy );
	}

	if ( ! copy.getAttribute( 'viewBox' ) ) {
		copy.setAttribute( 'viewBox', `0 0 ${ width } ${ height }` );
	}

	copy.setAttribute( 'width', width * scale );
	copy.setAttribute( 'height', height * scale );

	// The size the page, or the zoom, gave it.
	[ 'width', 'height', 'max-width' ].forEach( ( property ) =>
		copy.style.removeProperty( property )
	);
	if ( ! copy.getAttribute( 'style' ) ) {
		copy.removeAttribute( 'style' );
	}

	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		new window.XMLSerializer().serializeToString( copy )
	);
}

/**
 * Loads an image.
 *
 * @param {string} url The image's URL.
 *
 * @return {Promise<HTMLImageElement>} The loaded image.
 */
function loadImage( url ) {
	return new Promise( ( resolve, reject ) => {
		const image = new window.Image();

		image.onload = () => resolve( image );
		image.onerror = () =>
			reject(
				new Error( 'The diagram could not be loaded as an image.' )
			);
		image.src = url;
	} );
}

/**
 * Returns the background of the PNG of a diagram: white, or, for a diagram on
 * a dark surface, which is drawn with light text, the colour of that surface.
 * For a Pele diagram, the one its label boxes have.
 *
 * @param {SVGSVGElement} svg The rendered diagram, on the page.
 *
 * @return {string} A CSS colour.
 */
export function getPngBackground( svg ) {
	// A Pele diagram has the background of its palette, or of the surface it
	// was drawn on: its label boxes have it too.
	if ( isPele( svg ) ) {
		const background = readVariable( svg, '--pele-bg' );

		if ( background ) {
			return background;
		}
	}

	const { isDark, color } = getSurface( svg );

	if ( ! isDark ) {
		return PNG_BACKGROUND;
	}

	return color || PNG_DARK_BACKGROUND;
}

/**
 * Returns the background of the PNG of a diagram that isn't on a page: the
 * one its theme is made for.
 *
 * @param {string} theme What the diagram was drawn in, as resolveTheme()
 *                       returns it.
 *
 * @return {string} A CSS colour.
 */
export function getThemeBackground( theme ) {
	return isDarkTheme( theme ) ? PNG_DARK_BACKGROUND : PNG_BACKGROUND;
}

/**
 * Draws a diagram as a PNG, on a background its text can be read on: see
 * getPngBackground().
 *
 * The SVG is loaded from a `data:` URL. From a `blob:` URL, Chromium refuses
 * to read back a canvas that an SVG with HTML labels was drawn on.
 *
 * @param {SVGSVGElement} svg          The rendered diagram.
 * @param {string}        [background] The background, a CSS colour. Default:
 *                                     the one for the surface the diagram
 *                                     sits on in the page.
 *
 * @return {Promise<Blob>} The PNG. Rejects when the browser can't draw it.
 */
export async function getPngBlob( svg, background = getPngBackground( svg ) ) {
	const size = getDiagramSize( svg );
	const { width, height } = getPngSize( size );
	const image = await loadImage(
		'data:image/svg+xml;charset=utf-8,' +
			encodeURIComponent( getSvgMarkup( svg, width / size.width ) )
	);

	const canvas = document.createElement( 'canvas' );
	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext( '2d' );
	context.fillStyle = background;
	context.fillRect( 0, 0, width, height );
	context.drawImage( image, 0, 0, width, height );

	return new Promise( ( resolve, reject ) => {
		canvas.toBlob( ( blob ) => {
			if ( blob ) {
				resolve( blob );
			} else {
				reject( new Error( 'The PNG could not be created.' ) );
			}
		}, 'image/png' );
	} );
}

/**
 * Makes the browser download a file.
 *
 * @param {Blob}   blob The file's content.
 * @param {string} name The file's name.
 */
function saveFile( blob, name ) {
	const url = window.URL.createObjectURL( blob );
	const link = document.createElement( 'a' );

	link.href = url;
	link.download = name;
	link.hidden = true;
	document.body.appendChild( link );
	link.click();
	link.remove();

	setTimeout( () => window.URL.revokeObjectURL( url ), RELEASE_DELAY );
}

/**
 * Downloads a diagram as a file.
 *
 * @param {SVGSVGElement} svg    The rendered diagram.
 * @param {string}        format `svg` or `png`.
 *
 * @return {Promise<void>} Resolves once the download started. Rejects when the
 * file could not be created.
 */
export async function downloadDiagram( svg, format ) {
	const blob =
		format === 'png'
			? await getPngBlob( svg )
			: new window.Blob( [ getSvgMarkup( svg ) ], {
					type: 'image/svg+xml;charset=utf-8',
			  } );

	saveFile( blob, `${ FILE_NAME }.${ format }` );
}

/**
 * Tells whether the browser can put an image on the clipboard. It can only on
 * pages served over HTTPS, or from localhost.
 *
 * @param {Window} [view] The window. Default: the current one.
 *
 * @return {boolean} True when copyDiagram() can work.
 */
export function canCopyImage( view = window ) {
	const { clipboard } = view.navigator;

	return (
		typeof view.ClipboardItem === 'function' &&
		!! clipboard &&
		typeof clipboard.write === 'function'
	);
}

/**
 * Puts a diagram on the clipboard as a PNG: the image downloadDiagram() saves.
 *
 * The clipboard gets the PNG as a promise, so it is written to while the click
 * that asked for it still counts as one: Safari refuses a write that starts
 * after the PNG has been drawn.
 *
 * @param {SVGSVGElement} svg The rendered diagram.
 *
 * @return {Promise<void>} Resolves once the image is on the clipboard. Rejects
 * when the PNG could not be created or the browser refused to copy it.
 */
export function copyDiagram( svg ) {
	return window.navigator.clipboard.write( [
		new window.ClipboardItem( { 'image/png': getPngBlob( svg ) } ),
	] );
}
