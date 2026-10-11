import { __ } from '@wordpress/i18n';

const mindMap = {
	name: 'mindmap',
	title: __( 'Mind Map', 'mermaid-blocks' ),
	description: __(
		'A preconfigured MermaidJS block for creating mind maps.',
		'mermaid-blocks'
	),
	attributes: {
		code: `mindmap
Origins
      Long history
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness and features
      On Automatic creation
        Uses
            Creative techniques
            Strategic planning
            Argument mapping
    Tools
      Pen and paper
      Mermaid`,
	},
	keywords: [
		__( 'mindmap', 'mermaid-blocks' ),
		__( 'diagram', 'mermaid-blocks' ),
		__( 'mermaid', 'mermaid-blocks' ),
	],
	icon: 'admin-users',
	scope: 'transform',
};

export default mindMap;
