import watchPanel, { SECTION, WIDGET, showTheme } from '../elementor-editor';

const ALIASES = { forest: 'default', 'neo-dark': 'dark' };

/**
 * Stands in for the panel of an element in Elementor's editor: its model, and
 * the select of the theme, as Elementor rendered it.
 *
 * @param {string} theme      The widget's theme.
 * @param {string} widgetType The type of the widget.
 *
 * @return {Object} The panel, and the select.
 */
function fakePanel( theme, widgetType = WIDGET ) {
	const element = document.createElement( 'div' );
	element.innerHTML = `<select data-setting="theme">
		<option value="">Site default (Light)</option>
		<option value="auto">Automatic</option>
		<option value="default">Light</option>
		<option value="dark">Dark</option>
	</select>`;

	const select = element.querySelector( 'select' );
	// What Elementor does with a value it has no option for.
	select.value = theme;

	const values = { widgetType, settings: { get: () => theme } };
	const panel = {
		model: { get: ( key ) => values[ key ] },
		$el: {
			find: ( selector ) => ( {
				val: ( value ) => {
					element.querySelector( selector ).value = value;
				},
			} ),
		},
	};

	return { panel, select };
}

describe( 'showTheme', () => {
	it( 'shows a theme that is not offered as the one it is drawn as', () => {
		const { panel, select } = fakePanel( 'forest' );

		expect( select.value ).toBe( '' );

		showTheme( SECTION, panel, ALIASES );

		expect( select.value ).toBe( 'default' );

		const dark = fakePanel( 'neo-dark' );
		showTheme( SECTION, dark.panel, ALIASES );

		expect( dark.select.value ).toBe( 'dark' );
	} );

	it( 'leaves an offered theme, and no theme, as they are', () => {
		[ 'dark', '' ].forEach( ( theme ) => {
			const { panel, select } = fakePanel( theme );

			showTheme( SECTION, panel, ALIASES );

			expect( select.value ).toBe( theme );
		} );
	} );

	it( 'leaves other sections and other widgets alone', () => {
		const other = fakePanel( 'forest' );
		showTheme( 'section_diagram', other.panel, ALIASES );

		const heading = fakePanel( 'forest', 'heading' );
		showTheme( SECTION, heading.panel, ALIASES );

		expect( other.select.value ).toBe( '' );
		expect( heading.select.value ).toBe( '' );
		expect( () => showTheme( SECTION, {}, ALIASES ) ).not.toThrow();
	} );
} );

describe( 'watchPanel', () => {
	it( 'shows the theme each time Elementor opens a section', () => {
		let opened;
		const elementor = {
			channels: {
				editor: {
					on: jest.fn( ( event, handler ) => ( opened = handler ) ),
				},
			},
		};

		watchPanel( elementor, ALIASES );

		expect( elementor.channels.editor.on ).toHaveBeenCalledWith(
			'section:activated',
			expect.any( Function )
		);

		const { panel, select } = fakePanel( 'forest' );
		opened( SECTION, panel );

		expect( select.value ).toBe( 'default' );
	} );
} );
