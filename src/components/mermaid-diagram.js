/**
 * React hooks and utilities.
 *
 * @see https://react.dev/reference/react
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-element/
 */
import { useEffect, useRef } from '@wordpress/element';

/**
 * Hook to generate a unique ID for each component instance.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-compose/#useinstanceid
 */
import { useInstanceId } from '@wordpress/compose';

/**
 * Initializes MermaidJS globally.
 * Ensures Mermaid is properly set up for rendering diagrams.
 *
 * @see https://mermaid-js.github.io/mermaid/#/Setup
 */
import '../utils/mermaid-init';

/**
 * Mermaid Diagram Component
 * Renders MermaidJS diagrams inside a container using the global Mermaid.js object.
 *
 * This component receives MermaidJS code and renders the corresponding diagram.
 * If the MermaidJS code is invalid, it gracefully handles the error and displays
 * a fallback message.
 *
 * @param {Object} props             The component props.
 * @param {string} props.code        MermaidJS code to render.
 * @param {string} [props.className] Additional class names for styling the container.
 *
 * @return {JSX.Element} The rendered Mermaid diagram or an error fallback.
 *
 * @see https://mermaid-js.github.io/mermaid/#/
 */
export default function MermaidDiagram( { code, className } ) {
	/**
	 * Ref to the container element where the Mermaid diagram will be rendered.
	 * This allows direct manipulation of the DOM element for Mermaid's SVG output.
	 */
	const containerRef = useRef( null );

	/**
	 * A unique ID for the current component instance.
	 * Used as the `renderId` to distinguish diagrams.
	 *
	 * @type {string}
	 */
	const instanceId = useInstanceId( MermaidDiagram );

	// Effect to render the Mermaid diagram whenever the code or instanceId changes.
	useEffect( () => {
		// Ensure MermaidJS code and container are available before rendering
		if ( ! code || ! containerRef.current ) {
			return;
		}

		// Clear the container before rendering a new diagram
		containerRef.current.innerHTML = '';

		// Generate a unique ID for this rendering session
		const renderId = `mermaid-diagram-${ instanceId }`;

		// Attempt to render the Mermaid diagram
		window.mermaid
			.render( renderId, code )
			.then( ( { svg } ) => {
				// Insert the rendered SVG into the container
				containerRef.current.innerHTML = svg;
			} )
			.catch( ( error ) => {
				// Log the error to the console for debugging
				// eslint-disable-next-line no-console
				console.error( 'Mermaid rendering failed:', error );

				// Display a fallback message for invalid Mermaid syntax
				containerRef.current.innerHTML = `<p>Invalid Mermaid syntax</p>`;
			} );
	}, [ code, instanceId ] );

	return (
		<div
			// Attach the container ref and apply additional class names if provided
			ref={ containerRef }
			className={ `mermaid-container ${ className || '' }` }
		/>
	);
}
