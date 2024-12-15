const sequenceDiagram = {
	name: 'sequence-diagram',
	title: 'Sequence Diagram',
	description:
		'A preconfigured MermaidJS block for creating sequence diagrams.',
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
	keywords: [ 'sequence', 'diagram', 'mermaid' ],
	icon: 'networking',
	scope: 'transform',
};

export default sequenceDiagram;
