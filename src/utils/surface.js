/**
 * Tells what a diagram sits on: a dark surface or a light one. The theme of a
 * diagram that follows the page depends on it, and so does the background of
 * its PNG.
 */

// Below this luminance, white text is easier to read on a colour than black.
const DARK_BACKGROUND = 0.179;

// Text this light is only readable on something dark. Grey text on a light
// page stays below it.
const LIGHT_TEXT = 0.5;

// A background more transparent than this shows mostly what is behind it.
const OPAQUE = 0.5;

const RGB =
	/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/;

/**
 * Reads a colour the browser can draw, but that isn't written as `rgb()`: a
 * computed colour keeps the notation of the stylesheet for `oklch()`,
 * `color-mix()` and the like.
 *
 * @param {string}   value A CSS colour.
 * @param {Document} doc   A document to draw in.
 *
 * @return {{red: number, green: number, blue: number, alpha: number}|null}
 * The colour, or null when it could not be drawn.
 */
function drawColor( value, doc ) {
	try {
		const context = doc
			.createElement( 'canvas' )
			.getContext( '2d', { willReadFrequently: true } );

		context.fillStyle = value;
		context.fillRect( 0, 0, 1, 1 );

		const [ red, green, blue, alpha ] = context.getImageData(
			0,
			0,
			1,
			1
		).data;

		return { red, green, blue, alpha: alpha / 255 };
	} catch ( error ) {
		return null;
	}
}

/**
 * Reads a computed colour.
 *
 * @param {string}   value A computed `color` or `background-color`.
 * @param {Document} doc   The document it was computed in.
 *
 * @return {{red: number, green: number, blue: number, alpha: number}|null}
 * The colour, with channels from 0 to 255 and alpha from 0 to 1, or null when
 * there is none to read.
 */
function parseColor( value, doc ) {
	if ( ! value || value === 'transparent' ) {
		return null;
	}

	const match = RGB.exec( value );

	if ( ! match ) {
		return drawColor( value, doc );
	}

	const [ , red, green, blue, alpha = '1', percent ] = match;

	return {
		red: Number( red ),
		green: Number( green ),
		blue: Number( blue ),
		alpha: Number( alpha ) / ( percent ? 100 : 1 ),
	};
}

/**
 * Returns the relative luminance of a colour, as WCAG defines it.
 *
 * @param {{red: number, green: number, blue: number}} color The colour.
 *
 * @return {number} From 0, black, to 1, white.
 */
function getLuminance( { red, green, blue } ) {
	const [ r, g, b ] = [ red, green, blue ].map( ( channel ) => {
		const value = channel / 255;

		return value <= 0.03928
			? value / 12.92
			: ( ( value + 0.055 ) / 1.055 ) ** 2.4;
	} );

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Tells what an element sits on.
 *
 * The surface is the nearest background colour behind the element: its own,
 * or an ancestor's. A background image or gradient hides the colour and can't
 * be read, and so does a page that sets no background at all. The colour of
 * the element's text then tells: text is light where the surface is dark.
 *
 * @param {Element} element The element.
 *
 * @return {{isDark: boolean, color: (string|null)}} Whether the surface is
 * dark, and its colour when that is known.
 */
export function getSurface( element ) {
	const doc = element.ownerDocument;
	const view = doc.defaultView;

	for ( let node = element; node; node = node.parentElement ) {
		const style = view.getComputedStyle( node );

		if ( style.backgroundImage && style.backgroundImage !== 'none' ) {
			break;
		}

		const background = parseColor( style.backgroundColor, doc );

		if ( background && background.alpha >= OPAQUE ) {
			const { red, green, blue } = background;

			return {
				isDark: getLuminance( background ) < DARK_BACKGROUND,
				color: `rgb(${ red }, ${ green }, ${ blue })`,
			};
		}
	}

	const text = parseColor( view.getComputedStyle( element ).color, doc );

	return {
		isDark: !! text && getLuminance( text ) > LIGHT_TEXT,
		color: null,
	};
}
