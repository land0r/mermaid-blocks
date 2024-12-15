/**
 * WordPress dependencies
 */
import { registerBlockVariation } from '@wordpress/blocks';

/**
 * Import variations.
 */
import classDiagram from './class-diagram';
import flowchart from './flowchart';
import mindMap from './mind-map';
import sequenceDiagram from './sequence-diagram';
import stateDiagram from './state-diagram';

const variations = [
	classDiagram,
	flowchart,
	mindMap,
	sequenceDiagram,
	stateDiagram,
];

console.log( variations );

variations.forEach( ( variation ) => {
	registerBlockVariation( 'mermaid-blocks/diagram', {
		name: variation.name,
		title: variation.title,
		description: variation.description,
		attributes: variation.attributes,
		keywords: variation.keywords,
		icon: variation.icon,
		scope: variation.scope,
	} );
} );
