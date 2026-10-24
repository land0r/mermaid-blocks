/**
 * Tells when the content width of an element changes, so a diagram laid out
 * for that width can be drawn again.
 */
import getContentWidth from './content-width';

/**
 * Calls `onChange` when the content width of an element is not the one it was
 * last told about, at most once per animation frame. A change of height is no
 * change: a diagram drawn again for a new width has another height, and that
 * must not draw it again.
 *
 * @param {HTMLElement} element  The element. Its window's `ResizeObserver` and
 *                               `requestAnimationFrame` are used, so an element
 *                               in an iframe works.
 * @param {Function}    onChange Called without arguments. If it returns false
 *                               or a promise of false, the width is not taken
 *                               as drawn for, and the next resize tries again.
 *
 * @return {Function} Stops watching. Where the browser has no
 * `ResizeObserver`, as jsdom, nothing is watched and this does nothing.
 */
export default function watchWidth( element, onChange ) {
	const view = element.ownerDocument.defaultView;

	if ( ! view || typeof view.ResizeObserver !== 'function' ) {
		return () => {};
	}

	let width = getContentWidth( element );
	let frame = 0;

	const check = () => {
		frame = 0;

		const next = getContentWidth( element );

		if ( next === width ) {
			return;
		}

		const previous = width;

		width = next;

		Promise.resolve( onChange() ).then( ( changed ) => {
			if ( changed === false && width === next ) {
				width = previous;
			}
		} );
	};

	const observer = new view.ResizeObserver( () => {
		if ( ! frame ) {
			frame = view.requestAnimationFrame( check );
		}
	} );

	observer.observe( element );

	return () => {
		observer.disconnect();

		if ( frame ) {
			view.cancelAnimationFrame( frame );
			frame = 0;
		}
	};
}
