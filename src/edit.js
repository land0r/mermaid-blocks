/**
 * Retrieves the translation of text.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
 */
import { __ } from '@wordpress/i18n';

/**
 * React hook used to mark the block wrapper element. It provides necessary props
 * such as class names, styles, and more.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
 */
import {
	useBlockProps,
	BlockControls,
	InspectorControls,
} from '@wordpress/block-editor';

/**
 * Processes CSS, SASS, or SCSS files referenced in JavaScript files.
 * This file contains styles applied to the editor interface for this block.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './editor.scss';

/**
 * Debounce hook to delay the handling of input changes, reducing frequent updates,
 * and a hook to generate a unique ID for each block instance.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-compose/#usedebouncedinput
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-compose/#useinstanceid
 */
import { useDebouncedInput, useInstanceId } from '@wordpress/compose';

/**
 * Components for the block's sidebar and toolbar.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/panel/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/toggle-control/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/toolbar-dropdown-menu/
 */
import {
	PanelBody,
	PanelRow,
	ToggleControl,
	ToolbarDropdownMenu,
} from '@wordpress/components';

/**
 * Notices, to tell that a download failed.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/data/data-core-notices/
 */
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

/**
 * React hooks for lifecycle events, state and mutable values.
 *
 * @see https://react.dev/reference/react/useEffect
 * @see https://react.dev/reference/react/useRef
 * @see https://react.dev/reference/react/useState
 */
import {
	createInterpolateElement,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';

/**
 * The field the Mermaid code is written in.
 */
import CodeInput from './components/code-input';

/**
 * Component for rendering a Mermaid diagram. This is a custom React component
 * built to render MermaidJS diagrams in WordPress blocks.
 */
import MermaidDiagram from './components/mermaid-diagram';

/**
 * Turns the preview into a file, as the download buttons on the front end do.
 */
import { downloadDiagram } from './utils/export-diagram';

/**
 * Edit function for the block. This is the interface that will appear in the
 * WordPress editor when the block is used. It allows users to input MermaidJS
 * code and provides a live preview of the diagram.
 *
 * @param {Object}   props               The block properties.
 * @param {Object}   props.attributes    The attributes for the block.
 * @param {Function} props.setAttributes The function to update block attributes.
 *
 * @return {Element} The rendered block editor interface.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 */
export default function Edit( { attributes, setAttributes } ) {
	/**
	 * Destructure the block attributes.
	 * - `code`: The MermaidJS code for the diagram.
	 * - `zoom`, `download`: Whether visitors get the zoom controls and the
	 *   download buttons.
	 */
	const { code, zoom, download } = attributes;

	/**
	 * Debounced input handling for the MermaidJS code.
	 * - `inputValue`: The current value of the input field.
	 * - `setInputValue`: The setter function for the input field value.
	 * - `debouncedValue`: The debounced version of `inputValue`, updated after
	 *   a short delay to reduce frequent updates.
	 */
	const [ inputValue, setInputValue, debouncedValue ] = useDebouncedInput(
		code || ''
	);

	/**
	 * Synchronize the input value with the `code` attribute. If the `code`
	 * attribute changes externally (e.g., via undo/redo), update the input value.
	 */
	useEffect( () => {
		setInputValue( code ?? '' );
	}, [ code, setInputValue ] );

	/**
	 * Mutable references to `setAttributes` and `code` to avoid stale closures
	 * in subsequent `useEffect` calls.
	 */
	const setAttributesRef = useRef( setAttributes );
	const codeRef = useRef( code );

	// Keep references up-to-date with the latest values.
	useEffect( () => {
		setAttributesRef.current = setAttributes;
		codeRef.current = code;
	}, [ setAttributes, code ] );

	/**
	 * Update the `code` attribute when the debounced input value changes.
	 * This ensures that the block attribute is updated only after the user has
	 * stopped typing for a short period.
	 */
	useEffect( () => {
		if ( debouncedValue !== codeRef.current ) {
			setAttributesRef.current( { code: debouncedValue } );
		}
	}, [ debouncedValue ] );

	/**
	 * The error the preview shows, if any, so the code field can mark the line
	 * it points at and refer to its message.
	 */
	const [ error, setError ] = useState( null );
	const errorId = useInstanceId( Edit, 'mermaid-blocks-error' );

	/**
	 * Downloads the previewed diagram, whether or not visitors can. There is
	 * nothing to download without code, or while it has a syntax error.
	 */
	const hasPreview = !! debouncedValue.trim() && ! error;
	const previewRef = useRef( null );
	const { createErrorNotice } = useDispatch( noticesStore );

	const downloadPreview = ( format ) => {
		const svg = previewRef.current.querySelector(
			'.mermaid-container__diagram > svg'
		);

		if ( ! svg ) {
			return;
		}

		downloadDiagram( svg, format ).catch( () =>
			createErrorNotice(
				__( 'The file could not be created.', 'mermaid-blocks' ),
				{ type: 'snackbar' }
			)
		);
	};

	return (
		<div { ...useBlockProps() }>
			<BlockControls group="other">
				<ToolbarDropdownMenu
					icon="download"
					label={ __( 'Download', 'mermaid-blocks' ) }
					toggleProps={ { disabled: ! hasPreview } }
					controls={ [
						{
							title: __( 'Download as SVG', 'mermaid-blocks' ),
							onClick: () => downloadPreview( 'svg' ),
						},
						{
							title: __( 'Download as PNG', 'mermaid-blocks' ),
							onClick: () => downloadPreview( 'png' ),
						},
					] }
				/>
			</BlockControls>
			<InspectorControls>
				<PanelBody title={ __( 'Settings', 'mermaid-blocks' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Zoom controls', 'mermaid-blocks' ) }
						help={ __(
							'Visitors can zoom in on the diagram and move around it.',
							'mermaid-blocks'
						) }
						checked={ !! zoom }
						onChange={ ( value ) =>
							setAttributes( { zoom: value } )
						}
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Download buttons', 'mermaid-blocks' ) }
						help={ __(
							'Visitors can download the diagram as an SVG or PNG file.',
							'mermaid-blocks'
						) }
						checked={ !! download }
						onChange={ ( value ) =>
							setAttributes( { download: value } )
						}
					/>
				</PanelBody>
				<PanelBody
					title={ __( 'Instructions', 'mermaid-blocks' ) }
					initialOpen={ true }
				>
					<PanelRow>
						<p>
							{ createInterpolateElement(
								__(
									'Use <strong>MermaidJS syntax</strong> to create diagrams. For example:',
									'mermaid-blocks'
								),
								{ strong: <strong /> }
							) }
						</p>
					</PanelRow>
					<PanelRow>
						<code>
							flowchart LR
							<br />
							A[Start] --&gt; B[Decision]
							<br />
							B --&gt;|Yes| C[Result]
							<br />
							B --&gt;|No| D[Exit]
							<br />
						</code>
					</PanelRow>
					<PanelRow>
						<p>
							{ __(
								'Supported diagram types: flowchart, sequence diagram, Gantt chart, class, and many other diagrams.',
								'mermaid-blocks'
							) }{ ' ' }
							{ createInterpolateElement(
								__(
									'Visit <a>MermaidJS Documentation</a> for details.',
									'mermaid-blocks'
								),
								{
									a: (
										// eslint-disable-next-line jsx-a11y/anchor-has-content
										<a
											href="https://mermaid.js.org/intro/"
											target="_blank"
											rel="noopener noreferrer"
										/>
									),
								}
							) }
						</p>
					</PanelRow>
				</PanelBody>
			</InspectorControls>
			{ /* Field for entering MermaidJS code */ }
			<CodeInput
				label={ __( 'Mermaid Code', 'mermaid-blocks' ) }
				help={ __(
					'Tab and Shift+Tab indent and outdent. To leave the field, press Escape, then Tab.',
					'mermaid-blocks'
				) }
				placeholder={ __(
					'Write your MermaidJS code here…',
					'mermaid-blocks'
				) }
				value={ inputValue }
				onChange={ setInputValue }
				errorLine={ error ? error.line : null }
				errorId={ error ? errorId : undefined }
			/>
			{ /* Display the live preview of the Mermaid diagram */ }
			<div ref={ previewRef } style={ { marginTop: '20px' } }>
				<MermaidDiagram
					code={ debouncedValue }
					onError={ setError }
					errorId={ errorId }
				/>
			</div>
		</div>
	);
}
