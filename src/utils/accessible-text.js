/**
 * The accessible title and description of a rendered diagram.
 *
 * Mermaid writes them itself when the source has `accTitle` and `accDescr`:
 * a `<title>` and a `<desc>` at the start of the SVG, which `aria-labelledby`
 * and `aria-describedby` refer to. This writes the same markup for a title and
 * a description that come from outside the source, for every diagram type.
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Last first: each element is put at the start of the SVG.
const ELEMENTS = [
	{
		key: 'description',
		tag: 'desc',
		attribute: 'aria-describedby',
		idPrefix: 'chart-desc-',
	},
	{
		key: 'title',
		tag: 'title',
		attribute: 'aria-labelledby',
		idPrefix: 'chart-title-',
	},
];

/**
 * Gives a rendered diagram a title and a description for assistive
 * technology.
 *
 * @param {SVGSVGElement} svg                The rendered diagram.
 * @param {Object}        [text]             The text.
 * @param {string}        [text.title]       The title. Without one, the title
 *                                           from the diagram's source stays.
 * @param {string}        [text.description] The description. Without one, the
 *                                           description from the source stays.
 */
export function setAccessibleText( svg, text = {} ) {
	ELEMENTS.forEach( ( { key, tag, attribute, idPrefix } ) => {
		const value = ( text[ key ] || '' ).trim();

		if ( ! value ) {
			return;
		}

		let element = Array.from( svg.children ).find(
			( child ) => child.localName === tag
		);

		if ( ! element ) {
			element = svg.ownerDocument.createElementNS( SVG_NAMESPACE, tag );
			svg.insertBefore( element, svg.firstChild );
		}

		if ( ! element.id ) {
			element.id = `${ idPrefix }${ svg.id }`;
		}

		element.textContent = value;
		svg.setAttribute( attribute, element.id );
	} );
}

/**
 * Returns the title and the description a rendered diagram has, from its
 * source or from setAccessibleText(), so another drawing of it can get them.
 *
 * @param {SVGSVGElement} svg The rendered diagram.
 *
 * @return {{title: string, description: string}} The text: empty for none.
 */
export function getAccessibleText( svg ) {
	return Object.fromEntries(
		ELEMENTS.map( ( { key, tag } ) => {
			const element = Array.from( svg.children ).find(
				( child ) => child.localName === tag
			);

			return [ key, element ? element.textContent : '' ];
		} )
	);
}

/**
 * Returns the markup of a rendered diagram with a title and a description
 * for assistive technology.
 *
 * @param {string} markup The SVG markup Mermaid rendered.
 * @param {Object} [text] The text: see setAccessibleText().
 *
 * @return {string} The markup.
 */
export function withAccessibleText( markup, text ) {
	const template = document.createElement( 'template' );
	template.innerHTML = markup;

	const svg = template.content.querySelector( 'svg' );

	if ( ! svg ) {
		return markup;
	}

	setAccessibleText( svg, text );

	return template.innerHTML;
}
