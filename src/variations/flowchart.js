import { __ } from '@wordpress/i18n';

const flowchart = {
	name: 'flowchart',
	title: __( 'Flowchart', 'mermaid-blocks' ),
	description: __(
		'A preconfigured MermaidJS block for creating flowcharts.',
		'mermaid-blocks'
	),
	attributes: {
		code: `flowchart LR

A[Hard] -->|Text| B(Round)
B --> C{Decision}
C -->|One| D[Result 1]
C -->|Two| E[Result 2]`,
	},
	keywords: [
		__( 'flowchart', 'mermaid-blocks' ),
		__( 'diagram', 'mermaid-blocks' ),
	],
	scope: 'transform',
	icon: 'chart-bar',
};

export default flowchart;
