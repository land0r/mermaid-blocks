/**
 * The block in the editor: the preview of the diagram, its caption, the code
 * field while the block is selected, the sidebar, and a toolbar menu that
 * downloads or copies the preview.
 */
import { __ } from '@wordpress/i18n';
import {
	BlockControls,
	RichText,
	useBlockProps,
} from '@wordpress/block-editor';
import { ExternalLink, ToolbarDropdownMenu } from '@wordpress/components';
import { useDebounce, useInstanceId } from '@wordpress/compose';
import { useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';

import './editor.scss';

import CodeInput from './components/code-input';
import DiagramSettings from './components/diagram-settings';
import MermaidDiagram from './components/mermaid-diagram';
import { SITE_THEME, getOwnTheme } from './editor/settings';
import { getRenderer } from './renderers';
import { createFullLayout } from './utils/full-layout';
import { resolveTheme } from './utils/themes';
import {
	canCopyImage,
	copyDiagram,
	downloadDiagram,
} from './utils/export-diagram';

// How long the preview waits for typing to pause before it draws the code.
const PREVIEW_DELAY = 250;

const SYNTAX_URL = 'https://mermaid.js.org/intro/syntax-reference.html';

/**
 * The block's edit component.
 *
 * @param {Object}   props               The block's props.
 * @param {Object}   props.attributes    The block's attributes.
 * @param {Function} props.setAttributes Updates the block's attributes.
 * @param {boolean}  props.isSelected    Whether the block is selected.
 *
 * @return {JSX.Element} The block in the editor.
 */
export default function Edit( { attributes, setAttributes, isSelected } ) {
	const { code = '', theme, caption, accTitle, accDescr } = attributes;

	// The code is saved as it is typed, so a save right after typing has all
	// of it. Only the preview waits for a pause.
	const [ previewCode, setPreviewCode ] = useState( code );
	const updatePreview = useDebounce( setPreviewCode, PREVIEW_DELAY );

	useEffect( () => {
		updatePreview( code );
	}, [ code, updatePreview ] );

	// The error the preview shows, if any, so the code field can mark the line
	// it points at and refer to its message.
	const [ error, setError ] = useState( null );
	const errorId = useInstanceId( Edit, 'graphdraw-error' );

	const hasDiagram = !! previewCode.trim();
	const hasPreview = hasDiagram && ! error;

	// The code is shown while the block is selected, and where there is
	// something to fix: no code yet, or an error.
	const showCode = isSelected || ! code.trim() || !! error;

	const previewRef = useRef( null );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );

	const getPreviewSvg = () =>
		previewRef.current &&
		previewRef.current.querySelector( '.mermaid-container__diagram > svg' );

	// A Pele preview is laid out for the width of the editor: the file is drawn
	// again in full. The code and the theme are those of the preview.
	const getFullLayout = ( svg ) => {
		const container = svg.closest( '.mermaid-container' );

		return createFullLayout(
			getRenderer( svg.ownerDocument.defaultView ),
			svg,
			() => previewCode,
			() => resolveTheme( getOwnTheme( theme ) || SITE_THEME, container )
		);
	};

	const downloadPreview = ( format ) => {
		const svg = getPreviewSvg();

		if ( svg ) {
			downloadDiagram( svg, format, getFullLayout( svg ) ).catch( () =>
				createErrorNotice(
					__(
						'The file could not be created.',
						'graphdraw-mermaid-diagrams-flowcharts'
					),
					{ type: 'snackbar' }
				)
			);
		}
	};

	const copyPreview = () => {
		const svg = getPreviewSvg();

		if ( svg ) {
			copyDiagram( svg, getFullLayout( svg ) ).then(
				() =>
					createSuccessNotice(
						__(
							'Diagram copied as a PNG image.',
							'graphdraw-mermaid-diagrams-flowcharts'
						),
						{ type: 'snackbar' }
					),
				() =>
					createErrorNotice(
						__(
							'The image could not be copied.',
							'graphdraw-mermaid-diagrams-flowcharts'
						),
						{ type: 'snackbar' }
					)
			);
		}
	};

	const exportControls = [
		{
			title: __(
				'Download as SVG',
				'graphdraw-mermaid-diagrams-flowcharts'
			),
			onClick: () => downloadPreview( 'svg' ),
		},
		{
			title: __(
				'Download as PNG',
				'graphdraw-mermaid-diagrams-flowcharts'
			),
			onClick: () => downloadPreview( 'png' ),
		},
	];

	// Only where the browser can put an image on the clipboard.
	if ( canCopyImage() ) {
		exportControls.push( {
			title: __( 'Copy as PNG', 'graphdraw-mermaid-diagrams-flowcharts' ),
			onClick: copyPreview,
		} );
	}

	return (
		<div { ...useBlockProps() }>
			<BlockControls group="other">
				<ToolbarDropdownMenu
					icon="download"
					label={ __(
						'Download or copy',
						'graphdraw-mermaid-diagrams-flowcharts'
					) }
					toggleProps={ { disabled: ! hasPreview } }
					controls={ exportControls }
				/>
			</BlockControls>
			<DiagramSettings
				attributes={ attributes }
				setAttributes={ setAttributes }
			/>
			<figure
				ref={ previewRef }
				className="graphdraw-preview"
				hidden={ ! hasDiagram && RichText.isEmpty( caption ) }
			>
				<MermaidDiagram
					code={ previewCode }
					theme={ getOwnTheme( theme ) || SITE_THEME }
					title={ accTitle }
					description={ accDescr }
					onError={ setError }
					errorId={ errorId }
				/>
				{ /* The caption: offered for a diagram while the block is selected */ }
				{ ( ( isSelected && hasDiagram ) ||
					! RichText.isEmpty( caption ) ) && (
					<RichText
						identifier="caption"
						tagName="figcaption"
						className="graphdraw-diagram__caption wp-element-caption"
						aria-label={ __(
							'Diagram caption',
							'graphdraw-mermaid-diagrams-flowcharts'
						) }
						placeholder={ __(
							'Add caption',
							'graphdraw-mermaid-diagrams-flowcharts'
						) }
						value={ caption }
						onChange={ ( value ) =>
							setAttributes( { caption: value || undefined } )
						}
					/>
				) }
			</figure>
			{ /* Below the preview, so the diagram that was clicked stays put */ }
			{ showCode && (
				<CodeInput
					className="graphdraw-code"
					label={ __(
						'Mermaid Code',
						'graphdraw-mermaid-diagrams-flowcharts'
					) }
					help={
						<>
							{ __(
								'Tab indents. To leave the field, press Esc, then Tab.',
								'graphdraw-mermaid-diagrams-flowcharts'
							) }{ ' ' }
							<ExternalLink href={ SYNTAX_URL }>
								{ __(
									'Mermaid syntax',
									'graphdraw-mermaid-diagrams-flowcharts'
								) }
							</ExternalLink>
						</>
					}
					placeholder={ __(
						'Write your MermaidJS code here…',
						'graphdraw-mermaid-diagrams-flowcharts'
					) }
					value={ code }
					onChange={ ( value ) => setAttributes( { code: value } ) }
					errorLine={ error ? error.line : null }
					errorId={ error ? errorId : undefined }
				/>
			) }
		</div>
	);
}
