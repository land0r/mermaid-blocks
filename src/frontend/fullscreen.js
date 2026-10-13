/**
 * Shows a rendered diagram over the whole screen, and back.
 *
 * Where the browser can show an element fullscreen, it does. Elsewhere, as on
 * an iPhone, the diagram becomes an overlay that covers the page instead, and
 * the page behind it stops scrolling. Escape closes both.
 *
 * Either way the diagram gets the `is-fullscreen` class, which lays it out
 * (see style.scss), and the colour of what it sat on as its background: the
 * page is no longer behind it.
 */
import { getSurface } from '../utils/surface';

const ACTIVE_CLASS = 'is-fullscreen';
const OVERLAY_CLASS = 'is-fullscreen-overlay';
const SURFACE_PROPERTY = '--mermaid-blocks-surface';

// The background of a diagram whose page tells no colour: see getSurface().
const LIGHT_SURFACE = '#fff';
const DARK_SURFACE = '#1e1e1e';

// A diagram that is drawn again gets new controls, and keeps its state.
const states = new WeakMap();

/**
 * Makes a rendered diagram able to go fullscreen.
 *
 * @param {HTMLElement} diagram    The diagram element. It gets the
 *                                 `is-fullscreen` class, and
 *                                 `is-fullscreen-overlay` when it covers the
 *                                 page itself.
 * @param {Function}    [onChange] Called after every change with whether the
 *                                 diagram is fullscreen.
 *
 * @return {{toggle: Function, isActive: Function}} The action of the
 * fullscreen button, and whether the diagram is fullscreen now.
 */
export default function createFullscreen( diagram, onChange = () => {} ) {
	const doc = diagram.ownerDocument;
	let state = states.get( diagram );

	if ( state ) {
		state.onChange = onChange;

		return state.actions;
	}

	state = { active: false, native: false, overflow: '', onChange };
	states.set( diagram, state );

	// A browser leaves fullscreen on Escape by itself, and most don't tell the
	// page about the key. The overlay has only this.
	const onKeyDown = ( event ) => {
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			leave();
		}
	};

	/**
	 * Covers the page with the diagram, where the browser shows no element
	 * fullscreen, or refused to.
	 */
	function showOverlay() {
		state.native = false;
		state.overflow = doc.documentElement.style.overflow;
		doc.documentElement.style.overflow = 'hidden';
		diagram.classList.add( OVERLAY_CLASS );
	}

	function enter() {
		const { isDark, color } = getSurface( diagram );

		diagram.style.setProperty(
			SURFACE_PROPERTY,
			color || ( isDark ? DARK_SURFACE : LIGHT_SURFACE )
		);
		diagram.classList.add( ACTIVE_CLASS );
		doc.addEventListener( 'keydown', onKeyDown );
		state.active = true;

		if (
			doc.fullscreenEnabled &&
			typeof diagram.requestFullscreen === 'function'
		) {
			state.native = true;

			// Refused, for example in an iframe that may not go fullscreen.
			Promise.resolve()
				.then( () => diagram.requestFullscreen() )
				.catch( () => {
					if ( state.active && state.native ) {
						showOverlay();
					}
				} );
		} else {
			showOverlay();
		}

		state.onChange( true );
	}

	function leave() {
		if ( ! state.active ) {
			return;
		}

		state.active = false;

		if ( state.native ) {
			if ( doc.fullscreenElement === diagram ) {
				Promise.resolve()
					.then( () => doc.exitFullscreen() )
					.catch( () => {} );
			}
		} else {
			doc.documentElement.style.overflow = state.overflow;
		}

		state.native = false;
		doc.removeEventListener( 'keydown', onKeyDown );
		diagram.classList.remove( ACTIVE_CLASS, OVERLAY_CLASS );
		diagram.style.removeProperty( SURFACE_PROPERTY );
		state.onChange( false );
	}

	// The browser's own ways out of fullscreen, such as Escape.
	doc.addEventListener( 'fullscreenchange', () => {
		if (
			state.active &&
			state.native &&
			doc.fullscreenElement !== diagram
		) {
			leave();
		}
	} );

	state.actions = {
		toggle: () => ( state.active ? leave() : enter() ),
		isActive: () => state.active,
	};

	return state.actions;
}
