/**
 * The controls of a rendered diagram: buttons to zoom, to download it as an
 * SVG or PNG file, to copy its code, and to show it over the whole screen.
 *
 * A diagram gets the controls its `data-mermaid-controls` attribute lists:
 * any of `zoom`, `download`, `copy` and `fullscreen`, separated by spaces.
 * Without the attribute it gets none.
 */
import createZoom from './zoom';
import createFullscreen from './fullscreen';
import { downloadDiagram } from '../utils/export-diagram';
import { createFullLayout } from '../utils/full-layout';
import { REDRAWN_EVENT } from '../utils/redrawn-event';

const CANVAS_SELECTOR = '.mermaid-blocks-diagram__canvas';
const SOURCE_SELECTOR = '.mermaid-blocks-diagram__source';
const TOOLBAR_CLASS = 'mermaid-blocks-diagram__toolbar';
const BUTTON_CLASS = 'mermaid-blocks-diagram__button';
const STATUS_CLASS = 'mermaid-blocks-diagram__status';

// Pele's zoom of each canvas: it is enabled once for a canvas, however often
// the diagram gets its controls, and again for a canvas that took its place.
const peleZooms = new WeakMap();

// How long a message, such as a failed download or "Copied", stays.
const STATUS_DURATION = 5000;

// The labels come translated from includes/Assets.php. These stand in when a
// page was printed without them.
const DEFAULT_LABELS = {
	controls: 'Diagram controls',
	zoomIn: 'Zoom in',
	zoomOut: 'Zoom out',
	resetZoom: 'Reset zoom',
	downloadSvg: 'Download as SVG',
	downloadPng: 'Download as PNG',
	downloadError: 'The file could not be created.',
	copyCode: 'Copy code',
	copied: 'Copied.',
	copyError: 'The code could not be copied.',
	fullscreen: 'View fullscreen',
	exitFullscreen: 'Exit fullscreen',
};

const icon = ( paths ) =>
	`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ paths }</svg>`;

const ICONS = {
	zoomIn: icon( '<path d="M12 5v14M5 12h14"/>' ),
	zoomOut: icon( '<path d="M5 12h14"/>' ),
	resetZoom: icon(
		'<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>'
	),
	download: icon( '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>' ),
	copy: icon(
		'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'
	),
	fullscreen: icon( '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>' ),
	exitFullscreen: icon(
		'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'
	),
};

/**
 * Creates a button of the toolbar.
 *
 * @param {Document} doc     The document of the diagram.
 * @param {string}   label   What the button does, for its tooltip and for
 *                           assistive technology.
 * @param {string}   content The button's markup: an icon, and maybe text.
 * @param {Function} onClick Called when the button is used and not disabled.
 *
 * @return {HTMLButtonElement} The button.
 */
function createButton( doc, label, content, onClick ) {
	const button = doc.createElement( 'button' );

	button.type = 'button';
	button.className = BUTTON_CLASS;
	button.title = label;
	button.setAttribute( 'aria-label', label );
	button.innerHTML = content;
	button.addEventListener( 'click', () => {
		// Disabled buttons keep the focus, so they are not `disabled`.
		if ( button.getAttribute( 'aria-disabled' ) !== 'true' ) {
			onClick();
		}
	} );

	return button;
}

/**
 * Enables or disables a button.
 *
 * @param {HTMLButtonElement} button  The button.
 * @param {boolean}           enabled Whether it can be used.
 */
function setEnabled( button, enabled ) {
	if ( enabled ) {
		button.removeAttribute( 'aria-disabled' );
	} else {
		button.setAttribute( 'aria-disabled', 'true' );
	}
}

/**
 * Creates the place that tells what a button did when that can't be seen: a
 * download that failed, code that was copied. A message goes after a while.
 *
 * @param {Document} doc The document of the diagram.
 *
 * @return {{element: HTMLElement, show: Function, clear: Function}} The
 * element, and what shows a message in it and removes it.
 */
function createStatus( doc ) {
	const element = doc.createElement( 'span' );
	element.className = STATUS_CLASS;
	element.setAttribute( 'role', 'status' );

	let timer = null;

	const clear = () => {
		clearTimeout( timer );
		element.textContent = '';
	};

	const show = ( message ) => {
		clear();
		element.textContent = message;
		timer = setTimeout( clear, STATUS_DURATION );
	};

	return { element, show, clear };
}

/**
 * Creates the zoom buttons of a diagram, and makes it zoomable.
 *
 * @param {Document}      doc     The document of the diagram.
 * @param {HTMLElement}   diagram The diagram element.
 * @param {HTMLElement}   canvas  The element around the SVG.
 * @param {SVGSVGElement} svg     The rendered diagram.
 * @param {Object}        text    The labels.
 *
 * @return {{zoom: Object, buttons: HTMLButtonElement[]}} The zoom, and its
 * buttons.
 */
function createZoomButtons( doc, diagram, canvas, svg, text ) {
	const buttons = {};
	const zoom = createZoom( diagram, canvas, svg, update );

	function update( { canZoomIn, canZoomOut } ) {
		setEnabled( buttons.zoomOut, canZoomOut );
		setEnabled( buttons.zoomIn, canZoomIn );
		setEnabled( buttons.reset, canZoomOut );
	}

	buttons.zoomOut = createButton(
		doc,
		text.zoomOut,
		ICONS.zoomOut,
		zoom.zoomOut
	);
	buttons.zoomIn = createButton(
		doc,
		text.zoomIn,
		ICONS.zoomIn,
		zoom.zoomIn
	);
	buttons.reset = createButton(
		doc,
		text.resetZoom,
		ICONS.resetZoom,
		zoom.reset
	);

	update( { canZoomIn: true, canZoomOut: false } );

	return {
		zoom,
		buttons: [ buttons.zoomOut, buttons.zoomIn, buttons.reset ],
	};
}

/**
 * Makes a Pele diagram zoomable with Pele's own zoom: pinch, Ctrl or Cmd and
 * the wheel, drag, double-click, `+` `-` `0` and the arrow keys, and Pele's
 * buttons, which it puts in the canvas. The wheel alone is left to the page.
 * The zoom is refreshed when the diagram is drawn again in place.
 *
 * @param {HTMLElement} diagram  The diagram element.
 * @param {HTMLElement} canvas   The element around the SVG.
 * @param {Object}      renderer The Pele renderer.
 * @param {Object}      text     The labels.
 *
 * @return {Object} Pele's zoom.
 */
function enablePeleZoom( diagram, canvas, renderer, text ) {
	const zoom = renderer.enableZoom( canvas, {
		// Even a diagram that fits its column: the reader asked for the zoom.
		always: true,
		labels: {
			zoomIn: text.zoomIn,
			zoomOut: text.zoomOut,
			reset: text.resetZoom,
		},
	} );

	diagram.addEventListener( REDRAWN_EVENT, () => zoom.refresh() );
	peleZooms.set( canvas, zoom );

	return zoom;
}

/**
 * Creates the download buttons of a diagram.
 *
 * @param {Document}      doc    The document of the diagram.
 * @param {SVGSVGElement} svg    The rendered diagram.
 * @param {Object}        status Where to tell that a download failed.
 * @param {Object}        text   The labels.
 * @param {Function}      full   What gives a Pele diagram its full layout: see
 *                               createFullLayout().
 *
 * @return {HTMLButtonElement[]} The buttons.
 */
function createDownloadButtons( doc, svg, status, text, full ) {
	let busy = false;

	const download = ( format ) => () => {
		if ( busy ) {
			return;
		}

		busy = true;
		status.clear();

		downloadDiagram( svg, format, full )
			.catch( ( error ) => {
				status.show( text.downloadError );
				// eslint-disable-next-line no-console
				console.error(
					'Mermaid Blocks: failed to create the file.',
					error
				);
			} )
			.then( () => {
				busy = false;
			} );
	};

	return [
		createButton(
			doc,
			text.downloadSvg,
			`${ ICONS.download }SVG`,
			download( 'svg' )
		),
		createButton(
			doc,
			text.downloadPng,
			`${ ICONS.download }PNG`,
			download( 'png' )
		),
	];
}

/**
 * Creates the button that copies the code of a diagram.
 *
 * @param {Document}    doc     The document of the diagram.
 * @param {HTMLElement} diagram The diagram element.
 * @param {Object}      status  Where to tell that the code was copied, or
 *                              could not be.
 * @param {Object}      text    The labels.
 *
 * @return {HTMLButtonElement|null} The button, or null where code can't be
 * copied: the clipboard is only there on pages served over HTTPS.
 */
function createCopyButton( doc, diagram, status, text ) {
	const source = diagram.querySelector( SOURCE_SELECTOR );
	const { clipboard } = doc.defaultView.navigator;

	if (
		! source ||
		! clipboard ||
		typeof clipboard.writeText !== 'function'
	) {
		return null;
	}

	return createButton( doc, text.copyCode, ICONS.copy, () => {
		Promise.resolve()
			.then( () => clipboard.writeText( source.textContent ) )
			.then(
				() => status.show( text.copied ),
				( error ) => {
					status.show( text.copyError );
					// eslint-disable-next-line no-console
					console.error(
						'Mermaid Blocks: failed to copy the code.',
						error
					);
				}
			);
	} );
}

/**
 * Creates the button that shows a diagram over the whole screen, and back.
 *
 * @param {Document}    doc     The document of the diagram.
 * @param {HTMLElement} diagram The diagram element.
 * @param {Object|null} zoom    The zoom of the diagram, when it has one.
 * @param {Object}      text    The labels.
 *
 * @return {HTMLButtonElement} The button.
 */
function createFullscreenButton( doc, diagram, zoom, text ) {
	let fullscreen = null;

	const button = createButton( doc, text.fullscreen, ICONS.fullscreen, () =>
		fullscreen.toggle()
	);

	const show = ( active ) => {
		const label = active ? text.exitFullscreen : text.fullscreen;

		button.title = label;
		button.setAttribute( 'aria-label', label );
		button.innerHTML = active ? ICONS.exitFullscreen : ICONS.fullscreen;
	};

	fullscreen = createFullscreen( diagram, ( active ) => {
		show( active );

		// The zoom is relative to the size the diagram had.
		if ( zoom ) {
			zoom.reset();
		}

		// Escape leaves fullscreen from anywhere.
		if ( ! active ) {
			button.focus();
		}
	} );

	// A diagram that was drawn again may still be fullscreen.
	show( fullscreen.isActive() );

	return button;
}

/**
 * Adds the controls a rendered diagram asks for, in a toolbar above it.
 *
 * @param {HTMLElement} diagram    The diagram element.
 * @param {Object}      [labels]   Translated labels, by the keys of
 *                                 DEFAULT_LABELS.
 * @param {Object}      [renderer] The renderer the diagram was drawn with,
 *                                 which draws it again in full for a download:
 *                                 view.js hands it over, as this file has none.
 */
export default function addControls( diagram, labels, renderer ) {
	const canvas = diagram.querySelector( CANVAS_SELECTOR );
	const svg = canvas && canvas.querySelector( 'svg' );

	if ( ! svg || diagram.querySelector( `.${ TOOLBAR_CLASS }` ) ) {
		return;
	}

	const controls = ( diagram.dataset.mermaidControls || '' ).split( /\s+/ );
	const doc = diagram.ownerDocument;
	const text = { ...DEFAULT_LABELS, ...labels };
	const items = [];

	const status = createStatus( doc );
	let zoom = null;

	// Pele's renderer is the one with a zoom of its own.
	if (
		controls.includes( 'zoom' ) &&
		renderer &&
		typeof renderer.enableZoom === 'function'
	) {
		zoom =
			peleZooms.get( canvas ) ||
			enablePeleZoom( diagram, canvas, renderer, text );
	} else if ( controls.includes( 'zoom' ) && svg.hasAttribute( 'viewBox' ) ) {
		// Zooming scales the drawing through its `viewBox`.
		const zoomControls = createZoomButtons(
			doc,
			diagram,
			canvas,
			svg,
			text
		);

		zoom = zoomControls.zoom;
		items.push( ...zoomControls.buttons );
	}

	const actions = [];

	if ( controls.includes( 'download' ) ) {
		const source = diagram.querySelector( SOURCE_SELECTOR );
		const full = createFullLayout(
			renderer,
			svg,
			() => ( source ? source.textContent : '' ),
			() => canvas.dataset.mermaidTheme
		);

		actions.push(
			...createDownloadButtons( doc, svg, status, text, full )
		);
	}

	if ( controls.includes( 'copy' ) ) {
		const copy = createCopyButton( doc, diagram, status, text );

		if ( copy ) {
			actions.push( copy );
		}
	}

	// The status goes before the buttons it speaks for.
	if ( actions.length ) {
		items.push( status.element, ...actions );
	}

	if ( controls.includes( 'fullscreen' ) ) {
		items.push( createFullscreenButton( doc, diagram, zoom, text ) );
	}

	if ( ! items.length ) {
		return;
	}

	const toolbar = doc.createElement( 'div' );
	toolbar.className = TOOLBAR_CLASS;
	toolbar.setAttribute( 'role', 'group' );
	toolbar.setAttribute( 'aria-label', text.controls );
	toolbar.append( ...items );

	diagram.insertBefore( toolbar, canvas );
}
