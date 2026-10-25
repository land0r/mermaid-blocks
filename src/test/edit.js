/**
 * `@wordpress/*` packages are externals provided by WordPress at runtime and
 * are not installed in node_modules, so they are mocked as virtual modules:
 * React stands in for `@wordpress/element`, and the components are plain
 * elements.
 */
jest.mock(
	'@wordpress/element',
	() => ( {
		...jest.requireActual( 'react' ),
		createRoot: jest.requireActual( 'react-dom/client' ).createRoot,
	} ),
	{ virtual: true }
);

jest.mock(
	'@wordpress/i18n',
	() => ( {
		__: ( text ) => text,
		sprintf: ( format, value ) => format.replace( '%s', value ),
	} ),
	{ virtual: true }
);

jest.mock(
	'@wordpress/compose',
	() => {
		const { useMemo } = jest.requireActual( 'react' );

		return {
			useInstanceId: ( component, prefix ) => `${ prefix }-1`,
			// Waits as the real one does, on the timers of the test.
			useDebounce: ( callback, wait ) =>
				// eslint-disable-next-line react-hooks/rules-of-hooks
				useMemo( () => {
					let timer;

					return ( ...args ) => {
						clearTimeout( timer );
						timer = setTimeout( () => callback( ...args ), wait );
					};
				}, [ callback, wait ] ),
		};
	},
	{ virtual: true }
);

jest.mock(
	'@wordpress/block-editor',
	() => {
		const { createElement: h } = jest.requireActual( 'react' );
		const RichText = ( { value, placeholder } ) =>
			h( 'figcaption', null, value || placeholder );
		RichText.isEmpty = ( value ) => ! value;

		return {
			useBlockProps: ( props = {} ) => props,
			BlockControls: ( { children } ) =>
				h( 'div', { className: 'toolbar' }, children ),
			InspectorControls: ( { children } ) =>
				h( 'div', { className: 'sidebar' }, children ),
			RichText,
		};
	},
	{ virtual: true }
);

jest.mock(
	'@wordpress/components',
	() => {
		const { createElement: h } = jest.requireActual( 'react' );

		return {
			BaseControl: ( { className, label, help, children } ) =>
				h( 'div', { className }, label, children, help ),
			ExternalLink: ( { href, children } ) =>
				h( 'a', { href }, children ),
			PanelBody: ( { title, children } ) =>
				h( 'section', { title }, children ),
			SelectControl: ( { label } ) =>
				h( 'select', { 'aria-label': label } ),
			TextControl: ( { label } ) => h( 'input', { 'aria-label': label } ),
			TextareaControl: ( { label } ) =>
				h( 'textarea', { 'aria-label': label } ),
			ToggleControl: ( { label, checked, onChange } ) =>
				h(
					'label',
					null,
					h( 'input', {
						type: 'checkbox',
						checked,
						onChange: ( event ) => onChange( event.target.checked ),
					} ),
					label
				),
			ToolbarDropdownMenu: ( { controls } ) =>
				h(
					'div',
					{ role: 'menu' },
					controls.map( ( { title, onClick } ) =>
						h(
							'button',
							{ key: title, role: 'menuitem', onClick },
							title
						)
					)
				),
		};
	},
	{ virtual: true }
);

const mockNotices = {
	createErrorNotice: jest.fn(),
	createSuccessNotice: jest.fn(),
};

jest.mock( '@wordpress/data', () => ( { useDispatch: () => mockNotices } ), {
	virtual: true,
} );

jest.mock( '@wordpress/notices', () => ( { store: 'core/notices' } ), {
	virtual: true,
} );

// The preview: an SVG for code, and an error for code that says `broken`.
const mockPreview = {};

jest.mock( '../components/mermaid-diagram', () => {
	const { createElement: h, useEffect } = jest.requireActual( 'react' );

	return function MockDiagram( { code, onError } ) {
		const broken = code.includes( 'broken' );
		mockPreview.code = code;

		useEffect( () => {
			onError( broken ? { message: 'Parse error', line: 1 } : null );
		}, [ broken, onError ] );

		return h(
			'div',
			{ className: 'mermaid-container' },
			code && ! broken
				? h(
						'div',
						{ className: 'mermaid-container__diagram' },
						h( 'svg' )
				  )
				: null
		);
	};
} );

jest.mock( '../utils/export-diagram', () => ( {
	...jest.requireActual( '../utils/export-diagram' ),
	copyDiagram: jest.fn( () => Promise.resolve() ),
} ) );

import { act, createRoot } from '@wordpress/element';

import Edit from '../edit';
import { copyDiagram } from '../utils/export-diagram';

global.IS_REACT_ACT_ENVIRONMENT = true;

const CODE = 'flowchart LR\n    A --> B';

let root;
let container;
let setAttributes;

/**
 * Renders the block, or renders it again with other props.
 *
 * @param {Object}  attributes The block's attributes.
 * @param {boolean} isSelected Whether the block is selected.
 */
function render( attributes, isSelected = false ) {
	act( () =>
		root.render(
			<Edit
				attributes={ attributes }
				setAttributes={ setAttributes }
				isSelected={ isSelected }
			/>
		)
	);
}

const codeField = () =>
	container.querySelector( '.graphdraw-code-input__textarea' );

/**
 * Types in a field the way the browser reports it to React.
 *
 * @param {HTMLTextAreaElement} field The field.
 * @param {string}              value What the field holds after typing.
 */
function type( field, value ) {
	const { set } = Object.getOwnPropertyDescriptor(
		window.HTMLTextAreaElement.prototype,
		'value'
	);

	act( () => {
		set.call( field, value );
		field.dispatchEvent( new window.Event( 'input', { bubbles: true } ) );
	} );
}

beforeEach( () => {
	jest.useFakeTimers();
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
	setAttributes = jest.fn();
	mockNotices.createErrorNotice.mockClear();
	mockNotices.createSuccessNotice.mockClear();
	copyDiagram.mockClear();
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
	jest.useRealTimers();
	delete window.ClipboardItem;
	delete window.navigator.clipboard;
} );

describe( 'the code', () => {
	it( 'is saved as it is typed, so a save right after typing has all of it', () => {
		render( { code: CODE }, true );

		type( codeField(), `${ CODE }\n    B --> C` );

		expect( setAttributes ).toHaveBeenCalledWith( {
			code: `${ CODE }\n    B --> C`,
		} );
	} );

	it( 'is drawn once typing pauses', () => {
		render( { code: CODE }, true );
		render( { code: `${ CODE }\n    B --> C` }, true );

		expect( mockPreview.code ).toBe( CODE );

		act( () => jest.advanceTimersByTime( 250 ) );

		expect( mockPreview.code ).toBe( `${ CODE }\n    B --> C` );
	} );

	it( 'shows only while the block is selected', () => {
		render( { code: CODE } );

		expect( codeField() ).toBeNull();

		render( { code: CODE }, true );

		expect( codeField() ).not.toBeNull();
	} );

	it( 'links to the syntax of Mermaid in its help', () => {
		render( { code: CODE }, true );

		expect( container.querySelector( '.graphdraw-code a' ).href ).toBe(
			'https://mermaid.js.org/intro/syntax-reference.html'
		);
	} );

	it( 'comes after the preview, so the diagram that was clicked stays put', () => {
		render( { code: CODE }, true );

		const preview = container.querySelector( '.graphdraw-preview' );

		expect( preview.nextElementSibling.className ).toBe( 'graphdraw-code' );
	} );

	it( 'shows when there is no code yet', () => {
		render( {} );

		expect( codeField() ).not.toBeNull();
		expect( container.querySelector( '.graphdraw-preview' ).hidden ).toBe(
			true
		);
	} );

	it( 'shows when it has an error', () => {
		render( { code: 'flowchart broken' } );

		expect( codeField() ).not.toBeNull();
	} );
} );

describe( 'the toolbar menu', () => {
	const titles = () =>
		Array.from(
			container.querySelectorAll( '[role="menuitem"]' ),
			( item ) => item.textContent
		);

	it( 'downloads where the clipboard takes no images', () => {
		render( { code: CODE }, true );

		expect( titles() ).toEqual( [ 'Download as SVG', 'Download as PNG' ] );
	} );

	it( 'copies the preview as a PNG where the clipboard takes images', async () => {
		window.ClipboardItem = class {};
		Object.defineProperty( window.navigator, 'clipboard', {
			configurable: true,
			value: { write: () => Promise.resolve() },
		} );
		render( { code: CODE }, true );

		expect( titles() ).toEqual( [
			'Download as SVG',
			'Download as PNG',
			'Copy as PNG',
		] );

		await act( async () =>
			container
				.querySelector( '[role="menuitem"]:last-child' )
				.dispatchEvent(
					new window.MouseEvent( 'click', { bubbles: true } )
				)
		);

		expect( copyDiagram ).toHaveBeenCalledWith(
			container.querySelector( '.mermaid-container__diagram > svg' ),
			expect.any( Function )
		);
		expect( mockNotices.createSuccessNotice ).toHaveBeenCalled();
		expect( mockNotices.createErrorNotice ).not.toHaveBeenCalled();
	} );

	it( 'tells when the image could not be copied', async () => {
		window.ClipboardItem = class {};
		Object.defineProperty( window.navigator, 'clipboard', {
			configurable: true,
			value: { write: () => Promise.resolve() },
		} );
		copyDiagram.mockImplementationOnce( () =>
			Promise.reject( new Error( 'Denied' ) )
		);
		render( { code: CODE }, true );

		await act( async () =>
			container
				.querySelector( '[role="menuitem"]:last-child' )
				.dispatchEvent(
					new window.MouseEvent( 'click', { bubbles: true } )
				)
		);

		expect( mockNotices.createErrorNotice ).toHaveBeenCalledWith(
			'The image could not be copied.',
			{ type: 'snackbar' }
		);
	} );
} );

describe( 'the sidebar', () => {
	it( 'has no instructions, and no links', () => {
		render( { code: CODE }, true );

		const sidebar = container.querySelector( '.sidebar' );
		const panels = Array.from(
			sidebar.querySelectorAll( 'section' ),
			( panel ) => panel.title
		);

		expect( panels ).toEqual( [
			'Settings',
			'Visitor controls',
			'Accessibility',
		] );
		expect( sidebar.querySelector( 'a' ) ).toBeNull();
	} );

	it( 'turns on a control for visitors', () => {
		render( { code: CODE }, true );

		const toggles = container.querySelectorAll(
			'section[title="Visitor controls"] input[type="checkbox"]'
		);

		expect( toggles ).toHaveLength( 4 );

		act( () => toggles[ 3 ].click() );

		expect( setAttributes ).toHaveBeenCalledWith( { fullscreen: true } );
	} );
} );
