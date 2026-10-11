import { __ } from '@wordpress/i18n';

const stateDiagram = {
	name: 'state-diagram',
	title: __( 'State Diagram', 'mermaid-blocks' ),
	description: __(
		'A preconfigured MermaidJS block for creating state diagrams.',
		'mermaid-blocks'
	),
	attributes: {
		code: `stateDiagram-v2
[*] --> Still
Still --> [*]
Still --> Moving
Moving --> Still
Moving --> Crash
Crash --> [*]`,
	},
	keywords: [
		__( 'state', 'mermaid-blocks' ),
		__( 'diagram', 'mermaid-blocks' ),
		__( 'mermaid', 'mermaid-blocks' ),
	],
	icon: 'controls-play',
	scope: 'transform',
};

export default stateDiagram;
