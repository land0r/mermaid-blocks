/**
 * Internationalization helpers.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Notice component for displaying the syntax error.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/notice/
 */
import { Notice } from '@wordpress/components';

/**
 * React hooks and utilities.
 *
 * @see https://react.dev/reference/react
 */
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';

/**
 * Hook to generate a unique ID for each component instance.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-compose/#useinstanceid
 */
import { useInstanceId } from '@wordpress/compose';

import { getMermaid } from '../utils/mermaid-init';
import { renderDiagram } from '../utils/render-diagram';
import { THEMES, resolveTheme } from '../utils/themes';
import { withAccessibleText } from '../utils/accessible-text';
import watchSurface from '../utils/watch-surface';

/**
 * Mermaid Diagram Component
 * Renders MermaidJS diagrams with the Mermaid copy loaded in the window the
 * preview is displayed in (the editor canvas iframe), using the front-end
 * configuration, so the preview matches the published diagram.
 *
 * Empty code clears the preview. Invalid code shows Mermaid's own error
 * message (as text) in place of the diagram. Only the result of the latest
 * render is applied, and nothing is applied after unmount.
 *
 * @param {Object}   props               The component props.
 * @param {string}   props.code          MermaidJS code to render.
 * @param {string}   [props.theme]       The theme asked for: see
 *                                       resolveTheme(). Without one, the
 *                                       diagram follows the editor canvas,
 *                                       and is drawn again when the canvas or
 *                                       a block around it turns dark or light.
 * @param {string}   [props.title]       Title of the diagram for assistive
 *                                       technology.
 * @param {string}   [props.description] Description of the diagram for
 *                                       assistive technology.
 * @param {string}   [props.className]   Additional class names for styling the container.
 * @param {Function} [props.onError]     Called with the error shown, as
 *                                       `{ message, line }`, or with null when
 *                                       there is none.
 * @param {string}   [props.errorId]     Id for the element holding the error,
 *                                       so the code field can refer to it.
 *
 * @return {JSX.Element} The rendered Mermaid diagram or an error notice.
 *
 * @see https://mermaid-js.github.io/mermaid/#/
 */
export default function MermaidDiagram( {
	code,
	theme,
	title,
	description,
	className,
	onError,
	errorId,
} ) {
	const instanceId = useInstanceId( MermaidDiagram );

	// The preview container; its window decides which Mermaid copy renders.
	const containerRef = useRef( null );

	// Incrementing counter so every render call gets a unique Mermaid id.
	const renderCounter = useRef( 0 );

	const [ svg, setSvg ] = useState( '' );
	const [ error, setError ] = useState( null );

	// What the diagram is drawn in, known once the preview is in the canvas.
	const [ drawnTheme, setDrawnTheme ] = useState( null );

	useEffect( () => {
		const container = containerRef.current;
		const update = () => setDrawnTheme( resolveTheme( theme, container ) );

		update();

		// A theme of its own never changes with what is around the diagram.
		if ( THEMES.includes( theme ) ) {
			return;
		}

		return watchSurface( update, {
			view: container.ownerDocument.defaultView,
			element: container,
		} );
	}, [ theme ] );

	useEffect( () => {
		if ( ! drawnTheme ) {
			return;
		}

		// Empty or whitespace-only code clears the preview and any error.
		if ( ! code || ! code.trim() ) {
			setSvg( '' );
			setError( null );
			return;
		}

		const owner = getMermaid(
			containerRef.current &&
				containerRef.current.ownerDocument.defaultView
		);

		if ( ! owner ) {
			setSvg( '' );
			setError( {
				message: __(
					'The Mermaid library is not loaded.',
					'mermaid-blocks'
				),
				line: null,
			} );
			return;
		}

		let cancelled = false;
		renderCounter.current += 1;
		const renderId = `mermaid-diagram-${ instanceId }-${ renderCounter.current }`;

		renderDiagram(
			owner.mermaid,
			renderId,
			code,
			owner.document,
			drawnTheme
		).then( ( result ) => {
			// A newer render started, or the component unmounted.
			if ( cancelled ) {
				return;
			}

			if ( result.error ) {
				setSvg( '' );
				setError( result.error );
			} else {
				setSvg( result.svg );
				setError( null );
			}
		} );

		return () => {
			cancelled = true;
		};
	}, [ code, drawnTheme, instanceId ] );

	// As on the front end, where the script writes both into the SVG.
	const markup = useMemo(
		() => ( svg ? withAccessibleText( svg, { title, description } ) : '' ),
		[ svg, title, description ]
	);

	useEffect( () => {
		if ( onError ) {
			onError( error );
		}
	}, [ error, onError ] );

	let heading = null;
	if ( error ) {
		heading =
			error.line === null
				? __( 'Syntax error', 'mermaid-blocks' )
				: sprintf(
						/* translators: %d: line number in the Mermaid code where the error was found. */
						__( 'Syntax error on line %d', 'mermaid-blocks' ),
						error.line
				  );
	}

	return (
		<div
			ref={ containerRef }
			className={ `mermaid-container ${ className || '' }` }
		>
			{ error ? (
				<Notice status="error" isDismissible={ false }>
					<div id={ errorId }>
						<strong>{ heading }</strong>
						<pre className="mermaid-container__error">
							{ error.message }
						</pre>
					</div>
				</Notice>
			) : (
				// Mermaid's own sanitised SVG output.
				<div
					className="mermaid-container__diagram"
					dangerouslySetInnerHTML={ { __html: markup } }
				/>
			) }
		</div>
	);
}
