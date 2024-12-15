const stateDiagram = {
	name: 'state-diagram',
	title: 'State Diagram',
	description: 'A preconfigured MermaidJS block for creating state diagrams.',
	attributes: {
		code: `stateDiagram-v2
[*] --> Still
Still --> [*]
Still --> Moving
Moving --> Still
Moving --> Crash
Crash --> [*]`,
	},
	keywords: ['state', 'diagram', 'mermaid'],
	icon: 'controls-play',
	scope: 'transform',
};

export default stateDiagram;
