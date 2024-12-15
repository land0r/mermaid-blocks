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
import { useBlockProps } from '@wordpress/block-editor';

/**
 * Processes CSS, SASS, or SCSS files referenced in JavaScript files.
 * This file contains styles applied to the editor interface for this block.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './editor.scss';

/**
 * Debounce hook to delay the handling of input changes, reducing frequent updates.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-compose/#usedebouncedinput
 */
import { useDebouncedInput } from '@wordpress/compose';

/**
 * A textarea control component for input fields with WordPress UI consistency.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/textareacontrol/
 */
import { TextareaControl } from '@wordpress/components';

/**
 * React hooks for lifecycle events and mutable values.
 *
 * @see https://react.dev/reference/react/useEffect
 * @see https://react.dev/reference/react/useRef
 */
import { useEffect, useRef } from '@wordpress/element';

/**
 * Initializes MermaidJS globally.
 * Ensures Mermaid is properly set up for rendering diagrams.
 *
 * @see https://mermaid-js.github.io/mermaid/#/Setup
 */
import './utils/mermaid-init';

/**
 * Component for rendering a Mermaid diagram. This is a custom React component
 * built to render MermaidJS diagrams in WordPress blocks.
 */
import MermaidDiagram from './components/mermaid-diagram';

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
	 * Destructure the `code` attribute from the block attributes.
	 *
	 * @type {string} code - The MermaidJS code for the diagram.
	 */
	const { code } = attributes;

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

	return (
		<div { ...useBlockProps() }>
			{ /* Textarea for entering MermaidJS code */ }
			<TextareaControl
				label={ __( 'Mermaid Code', 'mermaid-blocks' ) }
				help={ __(
					'Write your MermaidJS code here…',
					'mermaid-blocks'
				) }
				placeholder={ __(
					'Write your MermaidJS code here…',
					'mermaid-blocks'
				) }
				rows={ 10 }
				value={ inputValue }
				onChange={ setInputValue }
				__nextHasNoMarginBottom
			/>
			{ /* Display the live preview of the Mermaid diagram */ }
			<div style={ { marginTop: '20px' } }>
				<MermaidDiagram code={ debouncedValue } />
			</div>
		</div>
	);
}
