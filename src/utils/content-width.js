/**
 * Returns the width the content of an element has: its width less its
 * horizontal padding, which is the room a diagram shown in it has.
 *
 * @param {HTMLElement} element The element.
 *
 * @return {number} The width in pixels, or 0 for an element that isn't on a
 * page, is hidden, or has no width.
 */
export default function getContentWidth( element ) {
	const view = element.ownerDocument.defaultView;

	if ( ! view || ! element.isConnected ) {
		return 0;
	}

	const style = view.getComputedStyle( element );
	const width =
		element.clientWidth -
		( parseFloat( style.paddingLeft ) || 0 ) -
		( parseFloat( style.paddingRight ) || 0 );

	return width > 0 ? width : 0;
}
