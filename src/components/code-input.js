/**
 * Label and help text shared with the other editor controls.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/components/base-control/
 */
import { BaseControl } from '@wordpress/components';

/**
 * Hook to generate a unique ID for each component instance.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-compose/#useinstanceid
 */
import { useInstanceId } from '@wordpress/compose';

/**
 * React hooks.
 *
 * @see https://react.dev/reference/react
 */
import { useRef } from '@wordpress/element';

import { getIndentEdit } from '../utils/indent';

const MODIFIER_KEYS = [ 'Shift', 'Control', 'Alt', 'Meta' ];

/**
 * Makes an edit in a textarea the way typing would.
 *
 * @param {HTMLTextAreaElement} textarea The textarea.
 * @param {Object}              edit     An edit from getIndentEdit().
 * @param {Function}            onChange Called with the new value when the
 *                                       browser cannot make the edit itself.
 */
function applyEdit( textarea, edit, onChange ) {
	const { ownerDocument } = textarea;

	textarea.setSelectionRange( edit.start, edit.end );

	// An edit made through the browser fires the usual input event and stays
	// in the field's undo history.
	const command = edit.text === '' ? 'delete' : 'insertText';
	if (
		! ownerDocument.execCommand ||
		! ownerDocument.execCommand( command, false, edit.text )
	) {
		textarea.setRangeText( edit.text, edit.start, edit.end );
		onChange( textarea.value );
	}

	textarea.setSelectionRange( edit.selectionStart, edit.selectionEnd );
}

/**
 * A code field: a monospace textarea with line numbers that does not wrap
 * lines, so each line number stays next to its line.
 *
 * Tab and Shift+Tab indent and outdent instead of moving focus. Pressing
 * Escape first lets the next Tab move focus, so the field is not a keyboard
 * trap; say so in `help`.
 *
 * @param {Object}      props               The component props.
 * @param {string}      [props.className]   Class of the field's wrapper.
 * @param {string}      props.label         Label of the field.
 * @param {Element}     [props.help]        Help text shown under the field.
 * @param {string}      [props.placeholder] Placeholder of the field.
 * @param {string}      props.value         The code.
 * @param {Function}    props.onChange      Called with the new code.
 * @param {number|null} [props.errorLine]   1-based line to mark as the one an
 *                                          error points at.
 * @param {string}      [props.errorId]     Id of the element that describes the
 *                                          error in the code, when there is one.
 *
 * @return {JSX.Element} The code field.
 */
export default function CodeInput( {
	className,
	label,
	help,
	placeholder,
	value,
	onChange,
	errorLine = null,
	errorId,
} ) {
	const id = useInstanceId( CodeInput, 'graphdraw-code-input' );
	const wrapperRef = useRef( null );

	// Set by Escape: the next Tab moves focus instead of indenting.
	const tabLeaves = useRef( false );

	const lineCount = value.split( '\n' ).length;

	// The error belongs to the code as it was last rendered; lines may have
	// been deleted since.
	const markedLine =
		errorLine !== null && errorLine <= lineCount ? errorLine : null;

	const onKeyDown = ( event ) => {
		if ( event.key !== 'Tab' ) {
			if ( ! MODIFIER_KEYS.includes( event.key ) ) {
				tabLeaves.current = event.key === 'Escape';
			}
			return;
		}

		if (
			tabLeaves.current ||
			event.ctrlKey ||
			event.altKey ||
			event.metaKey ||
			event.nativeEvent.isComposing
		) {
			tabLeaves.current = false;
			return;
		}

		event.preventDefault();

		const { target } = event;
		const edit = getIndentEdit(
			target.value,
			target.selectionStart,
			target.selectionEnd,
			event.shiftKey
		);

		if ( edit ) {
			applyEdit( target, edit, onChange );
		}
	};

	// The line numbers and the error line follow the textarea's scrolling.
	const onScroll = ( event ) => {
		wrapperRef.current.style.setProperty(
			'--graphdraw-code-scroll',
			`${ event.target.scrollTop }px`
		);
	};

	const describedBy = [ help && `${ id }__help`, errorId ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<BaseControl
			className={ className }
			id={ id }
			label={ label }
			help={ help }
			__nextHasNoMarginBottom
		>
			<div ref={ wrapperRef } className="graphdraw-code-input" dir="ltr">
				<div
					className="graphdraw-code-input__gutter"
					aria-hidden="true"
				>
					<div className="graphdraw-code-input__line-numbers">
						{ Array.from( { length: lineCount }, ( _, index ) => (
							<div
								key={ index }
								className={
									index + 1 === markedLine
										? 'is-error'
										: undefined
								}
							>
								{ index + 1 }
							</div>
						) ) }
					</div>
				</div>
				<div className="graphdraw-code-input__field">
					{ markedLine !== null && (
						<div
							className="graphdraw-code-input__error-line"
							style={ {
								'--graphdraw-code-error-line': markedLine,
							} }
						/>
					) }
					<textarea
						id={ id }
						className="graphdraw-code-input__textarea"
						rows={ 10 }
						wrap="off"
						spellCheck={ false }
						autoCapitalize="off"
						autoComplete="off"
						autoCorrect="off"
						placeholder={ placeholder }
						value={ value }
						onChange={ ( event ) => onChange( event.target.value ) }
						// Capture phase: the block editor's own Tab handling,
						// on an ancestor, moves focus out of the block unless
						// the key has been handled by then.
						onKeyDownCapture={ onKeyDown }
						onBlur={ () => {
							tabLeaves.current = false;
						} }
						onScroll={ onScroll }
						aria-invalid={ errorId ? true : undefined }
						aria-describedby={ describedBy || undefined }
					/>
				</div>
			</div>
		</BaseControl>
	);
}
