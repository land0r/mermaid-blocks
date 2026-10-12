/**
 * Tells when a diagram's surface may have turned dark or light, so a diagram
 * that follows it can be drawn again.
 *
 * A page turns when the visitor's system does, where the theme follows it, or
 * when a dark mode switch changes a class or an attribute of the root element
 * or of the body. Colours often fade from one to the other, so the end of a
 * colour transition counts too: only then can the new colour be read.
 *
 * In the editor a block around the diagram can change colour as well, and
 * gets its colours only after the diagram's preview first rendered. Pass the
 * preview as `element` to watch the elements around it.
 */

// Changes come in bursts: the surface is looked at once it has settled.
const SETTLE_DELAY = 100;

/**
 * Calls `onChange` after the surface may have turned dark or light. It may
 * not have: `onChange` decides by looking.
 *
 * @param {Function} onChange          Called without arguments.
 * @param {Object}   [options]         What to watch.
 * @param {Window}   [options.view]    The window of the page.
 * @param {Element}  [options.element] An element whose ancestors are watched
 *                                     too. Without one, only the root element
 *                                     and the body are.
 *
 * @return {Function} Stops watching.
 */
export default function watchSurface(
	onChange,
	{ view = window, element } = {}
) {
	const doc = view.document;
	let timer = null;

	const schedule = () => {
		view.clearTimeout( timer );
		timer = view.setTimeout( onChange, SETTLE_DELAY );
	};

	const stops = [ () => view.clearTimeout( timer ) ];

	if ( typeof view.matchMedia === 'function' ) {
		const scheme = view.matchMedia( '(prefers-color-scheme: dark)' );

		if ( scheme && typeof scheme.addEventListener === 'function' ) {
			scheme.addEventListener( 'change', schedule );
			stops.push( () =>
				scheme.removeEventListener( 'change', schedule )
			);
		}
	}

	if ( typeof view.MutationObserver === 'function' ) {
		const observer = new view.MutationObserver( schedule );
		const nodes = new Set( [ doc.documentElement, doc.body ] );

		for ( let node = element; node; node = node.parentElement ) {
			nodes.add( node );
		}

		nodes.forEach( ( node ) => {
			if ( node ) {
				observer.observe( node, { attributes: true } );
			}
		} );
		stops.push( () => observer.disconnect() );
	}

	const onTransitionEnd = ( event ) => {
		if ( /color/.test( event.propertyName ) ) {
			schedule();
		}
	};

	doc.addEventListener( 'transitionend', onTransitionEnd );
	stops.push( () =>
		doc.removeEventListener( 'transitionend', onTransitionEnd )
	);

	return () => stops.forEach( ( stop ) => stop() );
}
