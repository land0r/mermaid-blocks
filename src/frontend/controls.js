/**
 * The controls of a rendered diagram: buttons to zoom, and to download it as
 * an SVG or PNG file.
 *
 * A diagram gets the controls its `data-mermaid-controls` attribute lists:
 * `zoom`, `download`, or both, separated by a space. Without the attribute it
 * gets none.
 */
import createZoom from './zoom';
import { downloadDiagram } from '../utils/export-diagram';

const CANVAS_SELECTOR = '.mermaid-blocks-diagram__canvas';
const TOOLBAR_CLASS = 'mermaid-blocks-diagram__toolbar';
const BUTTON_CLASS = 'mermaid-blocks-diagram__button';
const STATUS_CLASS = 'mermaid-blocks-diagram__status';

// How long a message, such as a failed download, stays.
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
 * Creates the zoom buttons of a diagram, and makes it zoomable.
 *
 * @param {Document}      doc     The document of the diagram.
 * @param {HTMLElement}   diagram The diagram element.
 * @param {HTMLElement}   canvas  The element around the SVG.
 * @param {SVGSVGElement} svg     The rendered diagram.
 * @param {Object}        text    The labels.
 *
 * @return {HTMLButtonElement[]} The buttons.
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

	return [ buttons.zoomOut, buttons.zoomIn, buttons.reset ];
}

/**
 * Creates the download buttons of a diagram, after the place that tells when
 * a download failed.
 *
 * @param {Document}      doc  The document of the diagram.
 * @param {SVGSVGElement} svg  The rendered diagram.
 * @param {Object}        text The labels.
 *
 * @return {HTMLElement[]} The status element and the buttons.
 */
function createDownloadButtons( doc, svg, text ) {
	const status = doc.createElement( 'span' );
	status.className = STATUS_CLASS;
	status.setAttribute( 'role', 'status' );

	let busy = false;
	let clearStatus = null;

	const download = ( format ) => () => {
		if ( busy ) {
			return;
		}

		busy = true;
		clearTimeout( clearStatus );
		status.textContent = '';

		downloadDiagram( svg, format )
			.catch( ( error ) => {
				status.textContent = text.downloadError;
				clearStatus = setTimeout( () => {
					status.textContent = '';
				}, STATUS_DURATION );
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
		status,
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
 * Adds the controls a rendered diagram asks for, in a toolbar above it.
 *
 * @param {HTMLElement} diagram  The diagram element.
 * @param {Object}      [labels] Translated labels, by the keys of
 *                               DEFAULT_LABELS.
 */
export default function addControls( diagram, labels ) {
	const canvas = diagram.querySelector( CANVAS_SELECTOR );
	const svg = canvas && canvas.querySelector( 'svg' );

	if ( ! svg || diagram.querySelector( `.${ TOOLBAR_CLASS }` ) ) {
		return;
	}

	const controls = ( diagram.dataset.mermaidControls || '' ).split( /\s+/ );
	const doc = diagram.ownerDocument;
	const text = { ...DEFAULT_LABELS, ...labels };
	const items = [];

	// Zooming scales the drawing through its `viewBox`.
	if ( controls.includes( 'zoom' ) && svg.hasAttribute( 'viewBox' ) ) {
		items.push( ...createZoomButtons( doc, diagram, canvas, svg, text ) );
	}

	if ( controls.includes( 'download' ) ) {
		items.push( ...createDownloadButtons( doc, svg, text ) );
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
