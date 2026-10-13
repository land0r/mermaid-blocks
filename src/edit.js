/**
 * Retrieves the translation of text.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * React hook used to mark the block wrapper element. It provides necessary props
 * such as class names, styles, and more. RichText is the field of the caption.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
 * @see https://developer.wordpress.org/block-editor/reference-guides/richtext/
 */
import {
	useBlockProps,
	BlockControls,
	InspectorControls,
	RichText,
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
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/external-link/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/panel/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/select-control/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/text-control/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/textarea-control/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/toggle-control/
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/toolbar-dropdown-menu/
 */
import {
	ExternalLink,
	PanelBody,
	PanelRow,
	SelectControl,
	TextControl,
	TextareaControl,
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
 * The themes a diagram can be drawn in.
 */
import { AUTO_THEME, THEMES } from './utils/themes';

/*
 * Printed before this script by mermaid-blocks.php: the labels of the themes,
 * by name and in the order they are offered; the site's theme, which a block
 * without a theme of its own is drawn in; and the URL of the page that theme
 * is set on, for those who may change it.
 */
const {
	themes: themeLabels = Object.fromEntries(
		[ AUTO_THEME, ...THEMES ].map( ( name ) => [ name, name ] )
	),
	theme: siteTheme = AUTO_THEME,
	settingsUrl = '',
} = window.mermaidBlocksEditorSettings || {};

const THEME_OPTIONS = [
	{
		value: '',
		label: sprintf(
			/* translators: %s: name of the theme set for the whole site, such as "Automatic" or "Forest". */
			__( 'Site default (%s)', 'mermaid-blocks' ),
			themeLabels[ siteTheme ] || siteTheme
		),
	},
	...Object.entries( themeLabels ).map( ( [ value, label ] ) => ( {
		value,
		label,
	} ) ),
];

/**
 * Edit function for the block. This is the interface that will appear in the
 * WordPress editor when the block is used. It allows users to input MermaidJS
 * code and provides a live preview of the diagram.
 *
 * @param {Object}   props               The block properties.
 * @param {Object}   props.attributes    The attributes for the block.
 * @param {Function} props.setAttributes The function to update block attributes.
 * @param {boolean}  props.isSelected    Whether the block is selected.
 *
 * @return {Element} The rendered block editor interface.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 */
export default function Edit( { attributes, setAttributes, isSelected } ) {
	/**
	 * Destructure the block attributes.
	 * - `code`: The MermaidJS code for the diagram.
	 * - `zoom`, `download`, `copy`, `fullscreen`: Whether visitors get the
	 *   zoom controls, the download buttons, the button that copies the code
	 *   and the one that shows the diagram over the whole screen.
	 * - `theme`: The theme the diagram is drawn in. Without one, the site's.
	 * - `caption`: The text shown under the diagram.
	 * - `accTitle`, `accDescr`: The title and the description of the diagram
	 *   for assistive technology.
	 */
	const {
		code,
		zoom,
		download,
		copy,
		fullscreen,
		theme,
		caption,
		accTitle,
		accDescr,
	} = attributes;

	// A theme that isn't offered counts as none, as it does on the front end.
	const ownTheme = THEME_OPTIONS.some( ( { value } ) => value === theme )
		? theme
		: '';

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
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Theme', 'mermaid-blocks' ) }
						help={
							<>
								{ __(
									'Automatic is the theme Mermaid picks for each type of diagram, or its dark counterpart on a dark background. A theme set in the code of the diagram takes precedence.',
									'mermaid-blocks'
								) }
								{ settingsUrl && (
									<>
										{ ' ' }
										<ExternalLink href={ settingsUrl }>
											{ __(
												'Change the site default',
												'mermaid-blocks'
											) }
										</ExternalLink>
									</>
								) }
							</>
						}
						value={ ownTheme }
						options={ THEME_OPTIONS }
						onChange={ ( value ) =>
							setAttributes( { theme: value || undefined } )
						}
					/>
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
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Copy code button', 'mermaid-blocks' ) }
						help={ __(
							'Visitors can copy the Mermaid code of the diagram.',
							'mermaid-blocks'
						) }
						checked={ !! copy }
						onChange={ ( value ) =>
							setAttributes( { copy: value } )
						}
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Fullscreen button', 'mermaid-blocks' ) }
						help={ __(
							'Visitors can view the diagram over the whole screen.',
							'mermaid-blocks'
						) }
						checked={ !! fullscreen }
						onChange={ ( value ) =>
							setAttributes( { fullscreen: value } )
						}
					/>
				</PanelBody>
				<PanelBody title={ __( 'Accessibility', 'mermaid-blocks' ) }>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Title', 'mermaid-blocks' ) }
						help={ __(
							'A short name for the diagram, read out by screen readers.',
							'mermaid-blocks'
						) }
						value={ accTitle || '' }
						onChange={ ( value ) =>
							setAttributes( { accTitle: value || undefined } )
						}
					/>
					<TextareaControl
						__nextHasNoMarginBottom
						label={ __( 'Description', 'mermaid-blocks' ) }
						help={ __(
							'What the diagram shows, for people who cannot see it.',
							'mermaid-blocks'
						) }
						value={ accDescr || '' }
						onChange={ ( value ) =>
							setAttributes( { accDescr: value || undefined } )
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
			<figure ref={ previewRef } className="mermaid-blocks-preview">
				<MermaidDiagram
					code={ debouncedValue }
					theme={ ownTheme || siteTheme }
					title={ accTitle }
					description={ accDescr }
					onError={ setError }
					errorId={ errorId }
				/>
				{ /* The caption: offered while the block is selected */ }
				{ ( isSelected || ! RichText.isEmpty( caption ) ) && (
					<RichText
						identifier="caption"
						tagName="figcaption"
						className="mermaid-blocks-diagram__caption wp-element-caption"
						aria-label={ __( 'Diagram caption', 'mermaid-blocks' ) }
						placeholder={ __( 'Add caption', 'mermaid-blocks' ) }
						value={ caption }
						onChange={ ( value ) =>
							setAttributes( { caption: value || undefined } )
						}
					/>
				) }
			</figure>
		</div>
	);
}
