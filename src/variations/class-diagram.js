import { __ } from '@wordpress/i18n';

const classDiagram = {
	name: 'class-diagram',
	title: __( 'Class Diagram', 'mermaid-blocks' ),
	description: __(
		'A preconfigured MermaidJS block for creating class diagrams.',
		'mermaid-blocks'
	),
	attributes: {
		code: `classDiagram
Class01 <|-- AveryLongClass : Cool
<<Interface>> Class01
Class09 --> C2 : Where am I?
Class09 --* C3
Class09 --|> Class07
Class07 : equals()
Class07 : Object[] elementData
Class01 : size()
Class01 : int chimp
Class01 : int gorilla
class Class10 {
  <<service>>
  int id
  size()
}`,
	},
	keywords: [
		__( 'class', 'mermaid-blocks' ),
		__( 'diagram', 'mermaid-blocks' ),
		__( 'mermaid', 'mermaid-blocks' ),
	],
	icon: 'database',
	scope: 'transform',
};

export default classDiagram;
