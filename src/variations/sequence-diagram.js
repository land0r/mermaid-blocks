import { __ } from '@wordpress/i18n';

const sequenceDiagram = {
	name: 'sequence-diagram',
	title: __( 'Sequence Diagram', 'mermaid-blocks' ),
	description: __(
		'A preconfigured MermaidJS block for creating sequence diagrams.',
		'mermaid-blocks'
	),
	attributes: {
		code: `sequenceDiagram
Alice->>John: Hello John, how are you?
loop HealthCheck
    John->>John: Fight against hypochondria
end
Note right of John: Rational thoughts!
John-->>Alice: Great!
John->>Bob: How about you?
Bob-->>John: Jolly good!`,
	},
	keywords: [
		__( 'sequence', 'mermaid-blocks' ),
		__( 'diagram', 'mermaid-blocks' ),
		__( 'mermaid', 'mermaid-blocks' ),
	],
	icon: 'networking',
	scope: 'transform',
};

export default sequenceDiagram;
