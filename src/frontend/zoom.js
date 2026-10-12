/**
 * Zoom and pan for one rendered diagram.
 *
 * Zooming makes the SVG wider than the canvas around it, and the canvas
 * scrolls (see style.scss). Panning is therefore the browser's own scrolling:
 * by touch, trackpad, scrollbar and arrow keys. Dragging with a mouse is added
 * here, and so is zooming with Ctrl or Cmd and the wheel, which is also what a
 * pinch on a trackpad sends. The wheel alone always scrolls the page.
 */

// The zoom buttons move between 1 and MAX_ZOOM in steps of STEP.
const STEP = 1.5;
const MAX_ZOOM = STEP ** 5;

// How far the mouse moves, in pixels, before a press becomes a drag.
const DRAG_THRESHOLD = 4;

// The most one wheel event zooms by, as a `deltaY`. A mouse wheel sends far
// larger values than a pinch.
const WHEEL_LIMIT = 50;
const WHEEL_LINE_HEIGHT = 16;

/**
 * Adds zooming and panning to a rendered diagram.
 *
 * @param {HTMLElement}   diagram    The diagram element. It gets the
 *                                   `is-zoomed` and `is-panning` classes.
 * @param {HTMLElement}   canvas     The element around the SVG, which scrolls.
 * @param {SVGSVGElement} svg        The rendered diagram.
 * @param {Function}      [onChange] Called after every change with
 *                                   `{ canZoomIn, canZoomOut }`.
 *
 * @return {{zoomIn: Function, zoomOut: Function, reset: Function}} The actions
 * of the zoom buttons.
 */
export default function createZoom(
	diagram,
	canvas,
	svg,
	onChange = () => {}
) {
	// The SVG's own size on the page, to return to.
	const original = { width: svg.style.width, maxWidth: svg.style.maxWidth };

	let zoom = 1;
	let fittedWidth = 0;
	let drag = null;
	let dragged = false;

	/**
	 * Zooms to a level, keeping one point of the diagram where it is.
	 *
	 * @param {number}                 next    The zoom level; 1 fits the page.
	 * @param {{x: number, y: number}} [point] The point to keep in place, in
	 *                                         viewport coordinates. Defaults
	 *                                         to the centre of the canvas.
	 *
	 * @return {boolean} Whether the zoom level changed.
	 */
	function setZoom( next, point ) {
		const target = Math.min( MAX_ZOOM, Math.max( 1, next ) );
		const before = svg.getBoundingClientRect();

		// Nothing to do, or nothing to measure: the diagram is hidden.
		if ( target === zoom || ! before.width || ! before.height ) {
			return false;
		}

		if ( zoom === 1 ) {
			fittedWidth = before.width;
		}

		const view = canvas.getBoundingClientRect();
		const { x, y } = point || {
			x: view.left + view.width / 2,
			y: view.top + view.height / 2,
		};
		const ratioX = ( x - before.left ) / before.width;
		const ratioY = ( y - before.top ) / before.height;

		zoom = target;

		if ( zoom === 1 ) {
			svg.style.width = original.width;
			svg.style.maxWidth = original.maxWidth;
			canvas.removeAttribute( 'tabindex' );
		} else {
			svg.style.width = `${ fittedWidth * zoom }px`;
			svg.style.maxWidth = 'none';
			// A scrolling element must be reachable by keyboard.
			canvas.tabIndex = 0;
		}

		diagram.classList.toggle( 'is-zoomed', zoom > 1 );

		const after = svg.getBoundingClientRect();
		canvas.scrollLeft += after.left + ratioX * after.width - x;
		canvas.scrollTop += after.top + ratioY * after.height - y;

		onChange( { canZoomIn: zoom < MAX_ZOOM, canZoomOut: zoom > 1 } );

		return true;
	}

	/**
	 * Zooms one step in or out. The wheel can leave the zoom between two
	 * steps, so this moves to the next step in that direction.
	 *
	 * @param {number} direction 1 to zoom in, -1 to zoom out.
	 */
	function step( direction ) {
		const level = Math.log( zoom ) / Math.log( STEP );
		// The margin absorbs the rounding error of a zoom that is on a step.
		const next =
			direction > 0
				? Math.floor( level + 0.001 ) + 1
				: Math.ceil( level - 0.001 ) - 1;

		setZoom( STEP ** next );
	}

	canvas.addEventListener(
		'wheel',
		( event ) => {
			if ( ! event.ctrlKey && ! event.metaKey ) {
				return;
			}

			const delta =
				event.deltaMode === 1
					? event.deltaY * WHEEL_LINE_HEIGHT
					: event.deltaY;
			const limited = Math.max(
				-WHEEL_LIMIT,
				Math.min( WHEEL_LIMIT, delta )
			);

			// At either end of the range, the browser zooms the page as usual.
			if (
				setZoom( zoom * 2 ** ( -limited / 100 ), {
					x: event.clientX,
					y: event.clientY,
				} )
			) {
				event.preventDefault();
			}
		},
		{ passive: false }
	);

	canvas.addEventListener( 'pointerdown', ( event ) => {
		// Touch and pen scroll the canvas themselves.
		if ( zoom > 1 && event.pointerType === 'mouse' && event.button === 0 ) {
			drag = {
				x: event.clientX,
				y: event.clientY,
				left: canvas.scrollLeft,
				top: canvas.scrollTop,
				moved: false,
			};
		}
	} );

	canvas.addEventListener( 'pointermove', ( event ) => {
		if ( ! drag ) {
			return;
		}

		// The button was released outside the canvas.
		// eslint-disable-next-line no-bitwise
		if ( ! ( event.buttons & 1 ) ) {
			drag = null;
			return;
		}

		const x = event.clientX - drag.x;
		const y = event.clientY - drag.y;

		if ( ! drag.moved ) {
			if (
				Math.abs( x ) < DRAG_THRESHOLD &&
				Math.abs( y ) < DRAG_THRESHOLD
			) {
				return;
			}

			// From here on the canvas gets the pointer's events, wherever it is.
			drag.moved = true;
			canvas.setPointerCapture( event.pointerId );
			diagram.classList.add( 'is-panning' );
		}

		canvas.scrollLeft = drag.left - x;
		canvas.scrollTop = drag.top - y;
	} );

	const endDrag = () => {
		if ( drag && drag.moved ) {
			diagram.classList.remove( 'is-panning' );

			// The click that ends a drag is not a click on the diagram.
			dragged = true;
			setTimeout( () => {
				dragged = false;
			}, 0 );
		}

		drag = null;
	};

	canvas.addEventListener( 'pointerup', endDrag );
	canvas.addEventListener( 'pointercancel', endDrag );

	canvas.addEventListener(
		'click',
		( event ) => {
			if ( dragged ) {
				event.preventDefault();
				event.stopPropagation();
			}
		},
		true
	);

	// Dragging a link in the diagram pans too, instead of dragging the link.
	canvas.addEventListener( 'dragstart', ( event ) => {
		if ( zoom > 1 ) {
			event.preventDefault();
		}
	} );

	return {
		zoomIn: () => step( 1 ),
		zoomOut: () => step( -1 ),
		reset: () => setZoom( 1 ),
	};
}
