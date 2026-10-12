<?php
/**
 * The types of diagram the plugin offers starter code for.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The diagram types with starter code, and the detection of a diagram's type.
 *
 * The one source of the starter code: the block's variations and the
 * `mermaid-blocks/list-diagram-types` ability both read it.
 */
final class DiagramTypes {

	/**
	 * Returns the diagram types with starter code, in the order they are
	 * offered.
	 *
	 * @return array[] Each type, by the name of its block variation: its
	 *                 `title`, `description`, the `keyword` its code starts
	 *                 with, the starter `code`, the `keywords` it is found by,
	 *                 and its `icon`, a Dashicon.
	 */
	public function get_all(): array {
		return array(
			'class-diagram'    => array(
				'title'       => __( 'Class Diagram', 'mermaid-blocks' ),
				'description' => __( 'A preconfigured MermaidJS block for creating class diagrams.', 'mermaid-blocks' ),
				'keyword'     => 'classDiagram',
				'code'        => implode(
					"\n",
					array(
						'classDiagram',
						'Class01 <|-- AveryLongClass : Cool',
						'<<Interface>> Class01',
						'Class09 --> C2 : Where am I?',
						'Class09 --* C3',
						'Class09 --|> Class07',
						'Class07 : equals()',
						'Class07 : Object[] elementData',
						'Class01 : size()',
						'Class01 : int chimp',
						'Class01 : int gorilla',
						'class Class10 {',
						'  <<service>>',
						'  int id',
						'  size()',
						'}',
					)
				),
				'keywords'    => array(
					__( 'class', 'mermaid-blocks' ),
					__( 'diagram', 'mermaid-blocks' ),
					__( 'mermaid', 'mermaid-blocks' ),
				),
				'icon'        => 'database',
			),
			'flowchart'        => array(
				'title'       => __( 'Flowchart', 'mermaid-blocks' ),
				'description' => __( 'A preconfigured MermaidJS block for creating flowcharts.', 'mermaid-blocks' ),
				'keyword'     => 'flowchart',
				'code'        => implode(
					"\n",
					array(
						'flowchart LR',
						'',
						'A[Hard] -->|Text| B(Round)',
						'B --> C{Decision}',
						'C -->|One| D[Result 1]',
						'C -->|Two| E[Result 2]',
					)
				),
				'keywords'    => array(
					__( 'flowchart', 'mermaid-blocks' ),
					__( 'diagram', 'mermaid-blocks' ),
				),
				'icon'        => 'chart-bar',
			),
			'mindmap'          => array(
				'title'       => __( 'Mind Map', 'mermaid-blocks' ),
				'description' => __( 'A preconfigured MermaidJS block for creating mind maps.', 'mermaid-blocks' ),
				'keyword'     => 'mindmap',
				'code'        => implode(
					"\n",
					array(
						'mindmap',
						'Origins',
						'      Long history',
						'      Popularisation',
						'        British popular psychology author Tony Buzan',
						'    Research',
						'      On effectiveness and features',
						'      On Automatic creation',
						'        Uses',
						'            Creative techniques',
						'            Strategic planning',
						'            Argument mapping',
						'    Tools',
						'      Pen and paper',
						'      Mermaid',
					)
				),
				'keywords'    => array(
					__( 'mindmap', 'mermaid-blocks' ),
					__( 'diagram', 'mermaid-blocks' ),
					__( 'mermaid', 'mermaid-blocks' ),
				),
				'icon'        => 'admin-users',
			),
			'sequence-diagram' => array(
				'title'       => __( 'Sequence Diagram', 'mermaid-blocks' ),
				'description' => __( 'A preconfigured MermaidJS block for creating sequence diagrams.', 'mermaid-blocks' ),
				'keyword'     => 'sequenceDiagram',
				'code'        => implode(
					"\n",
					array(
						'sequenceDiagram',
						'Alice->>John: Hello John, how are you?',
						'loop HealthCheck',
						'    John->>John: Fight against hypochondria',
						'end',
						'Note right of John: Rational thoughts!',
						'John-->>Alice: Great!',
						'John->>Bob: How about you?',
						'Bob-->>John: Jolly good!',
					)
				),
				'keywords'    => array(
					__( 'sequence', 'mermaid-blocks' ),
					__( 'diagram', 'mermaid-blocks' ),
					__( 'mermaid', 'mermaid-blocks' ),
				),
				'icon'        => 'networking',
			),
			'state-diagram'    => array(
				'title'       => __( 'State Diagram', 'mermaid-blocks' ),
				'description' => __( 'A preconfigured MermaidJS block for creating state diagrams.', 'mermaid-blocks' ),
				'keyword'     => 'stateDiagram-v2',
				'code'        => implode(
					"\n",
					array(
						'stateDiagram-v2',
						'[*] --> Still',
						'Still --> [*]',
						'Still --> Moving',
						'Moving --> Still',
						'Moving --> Crash',
						'Crash --> [*]',
					)
				),
				'keywords'    => array(
					__( 'state', 'mermaid-blocks' ),
					__( 'diagram', 'mermaid-blocks' ),
					__( 'mermaid', 'mermaid-blocks' ),
				),
				'icon'        => 'controls-play',
			),
		);
	}

	/**
	 * Returns the block's variations, one per diagram type. They are offered
	 * when a diagram block is transformed, not in the inserter.
	 *
	 * @return array[] The variations, as register_block_type() takes them.
	 */
	public function get_variations(): array {
		$variations = array();

		foreach ( $this->get_all() as $name => $type ) {
			$variations[] = array(
				'name'        => $name,
				'title'       => $type['title'],
				'description' => $type['description'],
				'attributes'  => array( 'code' => $type['code'] ),
				'keywords'    => $type['keywords'],
				'icon'        => $type['icon'],
				'scope'       => array( 'transform' ),
			);
		}

		return $variations;
	}

	/**
	 * Detects the type of a diagram: the keyword its first statement starts
	 * with, such as `flowchart`, `graph` or `sequenceDiagram`.
	 *
	 * Like Mermaid, it skips the front matter, directives, comments and blank
	 * lines before the first statement. It doesn't parse the diagram: the
	 * keyword says nothing about whether the rest is valid.
	 *
	 * @param mixed $code The Mermaid source.
	 *
	 * @return string The keyword, or an empty string when there is none.
	 */
	public function detect( $code ): string {
		$code = str_replace( array( "\r\n", "\r" ), "\n", (string) $code );

		// The front matter: YAML between two lines of three dashes, first in the source.
		$code = (string) preg_replace( '/^\s*---[ \t]*\n.*?\n---[ \t]*(\n|$)/s', '', $code, 1 );

		// Directives, such as %%{init: { "theme": "forest" } }%%, which may span lines.
		$code = (string) preg_replace( '/%%\{.*?\}%%/s', '', $code );

		foreach ( explode( "\n", $code ) as $line ) {
			$line = trim( $line );

			// Blank lines, and comments.
			if ( '' === $line || 0 === strpos( $line, '%%' ) ) {
				continue;
			}

			return preg_match( '/^[A-Za-z][\w-]*/', $line, $matches ) ? $matches[0] : '';
		}

		return '';
	}
}
