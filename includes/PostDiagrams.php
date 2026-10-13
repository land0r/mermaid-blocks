<?php
/**
 * The diagrams in the content of posts.
 *
 * @package MermaidBlocks
 */

namespace MermaidBlocks;

use WP_Error;
use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads, adds, changes and removes the diagram blocks in a post's content.
 *
 * Blocks have no ids, so a diagram is addressed by its index: its position
 * among the post's diagram blocks, in document order, nested blocks included,
 * counting from 0. Each diagram also has a hash of its block. A change must
 * name the hash it was based on, so a diagram that changed in the meantime,
 * or another diagram that moved to its index, is detected instead of being
 * overwritten.
 *
 * Every change is saved with wp_update_post(), so it is filtered as any other
 * edit, and the post keeps a revision of what it was before.
 */
final class PostDiagrams {

	/**
	 * The attributes of a diagram block that can be set, besides its code,
	 * with their types.
	 */
	const ATTRIBUTES = array(
		'theme'      => 'string',
		'caption'    => 'string',
		'zoom'       => 'boolean',
		'download'   => 'boolean',
		'copy'       => 'boolean',
		'fullscreen' => 'boolean',
		'accTitle'   => 'string',
		'accDescr'   => 'string',
		'align'      => 'string',
	);

	/**
	 * The diagram types, to detect a diagram's type.
	 *
	 * @var DiagramTypes
	 */
	private DiagramTypes $types;

	/**
	 * Sets up the diagrams.
	 *
	 * @param DiagramTypes $types The diagram types, to detect a diagram's type.
	 */
	public function __construct( DiagramTypes $types ) {
		$this->types = $types;
	}

	/**
	 * Returns the diagram blocks of a post.
	 *
	 * @param WP_Post $post The post.
	 *
	 * @return array[] The blocks, as parse_blocks() returns them, by index.
	 */
	public function get_all( WP_Post $post ): array {
		return $this->collect( parse_blocks( $post->post_content ) );
	}

	/**
	 * Returns one diagram block of a post.
	 *
	 * @param WP_Post $post  The post.
	 * @param int     $index The index of the diagram.
	 *
	 * @return array|null The block, or null when the post has no diagram at
	 *                    that index.
	 */
	public function get( WP_Post $post, int $index ): ?array {
		$diagrams = $this->get_all( $post );

		return isset( $diagrams[ $index ] ) ? $diagrams[ $index ] : null;
	}

	/**
	 * Returns the hash of a diagram block, which changes with any of its
	 * attributes.
	 *
	 * @param array $block The block.
	 *
	 * @return string The hash.
	 */
	public function get_hash( array $block ): string {
		return md5( serialize_block( $block ) );
	}

	/**
	 * Detects the type of a diagram block.
	 *
	 * @param array $block The block.
	 *
	 * @return string The keyword its code starts with, or an empty string: see
	 *                DiagramTypes::detect().
	 */
	public function get_type( array $block ): string {
		return $this->types->detect( isset( $block['attrs']['code'] ) ? $block['attrs']['code'] : '' );
	}

	/**
	 * Describes a diagram of a post, as the abilities return it.
	 *
	 * @param WP_Post $post  The post.
	 * @param int     $index The index of the diagram.
	 * @param array   $block The block.
	 *
	 * @return array The post, the index, the hash, the code, the detected type,
	 *               and the other attributes. `validated` is always false: PHP
	 *               can't parse Mermaid.
	 */
	public function describe( WP_Post $post, int $index, array $block ): array {
		$attributes = is_array( $block['attrs'] ) ? $block['attrs'] : array();
		$code       = isset( $attributes['code'] ) ? (string) $attributes['code'] : '';

		unset( $attributes['code'] );

		return array(
			'post_id'    => $post->ID,
			'index'      => $index,
			'hash'       => $this->get_hash( $block ),
			'code'       => $code,
			'type'       => $this->get_type( $block ),
			'validated'  => false,
			'attributes' => (object) $attributes,
		);
	}

	/**
	 * Creates a diagram block.
	 *
	 * @param string $code       The Mermaid source.
	 * @param array  $attributes Optional. Other attributes: see ATTRIBUTES.
	 *
	 * @return array The block, as parse_blocks() returns them.
	 */
	public function create_block( string $code, array $attributes = array() ): array {
		return array(
			'blockName'    => Block::NAME,
			'attrs'        => array( 'code' => $code ) + $this->merge_attributes( array(), $attributes ),
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);
	}

	/**
	 * Applies changes to the attributes of a diagram block. An empty string,
	 * false or null removes an attribute, which then takes its default: the
	 * site's theme, no caption, no controls.
	 *
	 * @param array $attributes The block's attributes.
	 * @param array $changes    The attributes to set: see ATTRIBUTES. Others are
	 *                          ignored.
	 *
	 * @return array The changed attributes.
	 */
	public function merge_attributes( array $attributes, array $changes ): array {
		foreach ( array_intersect_key( $changes, self::ATTRIBUTES ) as $name => $value ) {
			if ( 'boolean' === self::ATTRIBUTES[ $name ] ) {
				$value = rest_sanitize_boolean( $value );
			} elseif ( null !== $value ) {
				$value = (string) $value;
			}

			if ( '' === $value || false === $value || null === $value ) {
				unset( $attributes[ $name ] );
			} else {
				$attributes[ $name ] = $value;
			}
		}

		return $attributes;
	}

	/**
	 * Adds a diagram block to a post.
	 *
	 * @param WP_Post  $post     The post.
	 * @param array    $block    The block, as create_block() returns it.
	 * @param int|null $position Optional. The position among the post's
	 *                           top-level blocks to add it at, counting from 0.
	 *                           Default, or past the last block: at the end.
	 *
	 * @return int|WP_Error The index of the new diagram, or the error that kept
	 *                      the post from being saved.
	 */
	public function insert( WP_Post $post, array $block, ?int $position = null ) {
		$blocks    = parse_blocks( $post->post_content );
		$separator = $this->create_separator();

		// The offsets of the blocks that hold something: not the white space between them.
		$offsets = array_keys( array_filter( $blocks, array( $this, 'has_content' ) ) );

		if ( ! $offsets ) {
			$offset = count( $blocks );
			$insert = array( $block );
		} elseif ( null === $position || $position >= count( $offsets ) ) {
			$offset = count( $blocks );
			$insert = array( $separator, $block );
		} else {
			$offset = $offsets[ max( 0, $position ) ];
			$insert = array( $block, $separator );
		}

		$index = count( $this->collect( array_slice( $blocks, 0, $offset ) ) );

		array_splice( $blocks, $offset, 0, $insert );

		$saved = $this->save( $post, $blocks );

		return is_wp_error( $saved ) ? $saved : $index;
	}

	/**
	 * Replaces a diagram block of a post.
	 *
	 * @param WP_Post $post  The post.
	 * @param int     $index The index of the diagram.
	 * @param string  $hash  The hash of the diagram the change is based on.
	 * @param array   $block The new block.
	 *
	 * @return true|WP_Error True, or the error: the diagram is gone or changed,
	 *                       or the post couldn't be saved.
	 */
	public function replace( WP_Post $post, int $index, string $hash, array $block ) {
		return $this->change( $post, $index, $hash, $block );
	}

	/**
	 * Removes a diagram block from a post.
	 *
	 * @param WP_Post $post  The post.
	 * @param int     $index The index of the diagram.
	 * @param string  $hash  The hash of the diagram the change is based on.
	 *
	 * @return true|WP_Error True, or the error: the diagram is gone or changed,
	 *                       or the post couldn't be saved.
	 */
	public function remove( WP_Post $post, int $index, string $hash ) {
		return $this->change( $post, $index, $hash, null );
	}

	/**
	 * Replaces or removes a diagram block, once it checked that the diagram is
	 * the one the change is based on.
	 *
	 * @param WP_Post    $post  The post.
	 * @param int        $index The index of the diagram.
	 * @param string     $hash  The hash of the diagram the change is based on.
	 * @param array|null $block The new block, or null to remove the diagram.
	 *
	 * @return true|WP_Error True, or the error.
	 */
	private function change( WP_Post $post, int $index, string $hash, ?array $block ) {
		$blocks   = parse_blocks( $post->post_content );
		$diagrams = $this->collect( $blocks );

		if ( ! isset( $diagrams[ $index ] ) ) {
			return $this->get_not_found_error( $index );
		}

		if ( ! hash_equals( $this->get_hash( $diagrams[ $index ] ), $hash ) ) {
			return new WP_Error(
				'mermaid_blocks_diagram_changed',
				__( 'The diagram changed since it was read. Read it again, and base the change on what it is now.', 'mermaid-blocks' ),
				array( 'status' => 409 )
			);
		}

		$state = array(
			'index' => $index,
			'count' => 0,
			'block' => $block,
		);

		$blocks = $this->change_blocks( $blocks, $state );

		if ( null === $block ) {
			$blocks = $this->remove_extra_separators( $blocks );
		}

		return $this->save( $post, $blocks );
	}

	/**
	 * Returns the error for a diagram that isn't there.
	 *
	 * @param int $index The index of the diagram.
	 *
	 * @return WP_Error The error.
	 */
	public function get_not_found_error( int $index ): WP_Error {
		return new WP_Error(
			'mermaid_blocks_diagram_not_found',
			sprintf(
				/* translators: %d: The index of a diagram in a post, counting from 0. */
				__( 'The post has no diagram at index %d.', 'mermaid-blocks' ),
				$index
			),
			array( 'status' => 404 )
		);
	}

	/**
	 * Returns the diagram blocks among blocks and their inner blocks, in
	 * document order.
	 *
	 * @param array[] $blocks The blocks.
	 *
	 * @return array[] The diagram blocks.
	 */
	private function collect( array $blocks ): array {
		$diagrams = array();

		foreach ( $blocks as $block ) {
			if ( Block::NAME === $block['blockName'] ) {
				$diagrams[] = $block;
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				$diagrams = array_merge( $diagrams, $this->collect( $block['innerBlocks'] ) );
			}
		}

		return $diagrams;
	}

	/**
	 * Replaces or removes the diagram at the index in `$state`, among blocks
	 * and their inner blocks.
	 *
	 * @param array[] $blocks The blocks.
	 * @param array   $state  The index of the diagram, the number of diagrams
	 *                        passed so far, and the new block or null.
	 *
	 * @return array[] The blocks, changed.
	 */
	private function change_blocks( array $blocks, array &$state ): array {
		$changed = array();

		foreach ( $blocks as $block ) {
			$block = $this->change_block( $block, $state );

			if ( null !== $block ) {
				$changed[] = $block;
			}
		}

		return $changed;
	}

	/**
	 * Replaces or removes the diagram at the index in `$state`, if it is this
	 * block or one of its inner blocks.
	 *
	 * @param array $block The block.
	 * @param array $state See change_blocks().
	 *
	 * @return array|null The block, changed, or null when it was removed.
	 */
	private function change_block( array $block, array &$state ): ?array {
		if ( Block::NAME === $block['blockName'] && $state['count']++ === $state['index'] ) {
			return $state['block'];
		}

		if ( empty( $block['innerBlocks'] ) ) {
			return $block;
		}

		/*
		 * Each null in `innerContent` stands for the next inner block, so a
		 * removed inner block takes its null with it.
		 */
		$inner_blocks  = array();
		$inner_content = array();
		$position      = 0;

		foreach ( $block['innerContent'] as $chunk ) {
			if ( null !== $chunk ) {
				$inner_content[] = $chunk;
				continue;
			}

			$inner_block = $this->change_block( $block['innerBlocks'][ $position++ ], $state );

			if ( null !== $inner_block ) {
				$inner_blocks[]  = $inner_block;
				$inner_content[] = null;
			}
		}

		$block['innerBlocks']  = $inner_blocks;
		$block['innerContent'] = $inner_content;

		return $block;
	}

	/**
	 * Tells whether a top-level block holds something, rather than the white
	 * space between two blocks.
	 *
	 * @param array $block The block.
	 *
	 * @return bool False for white space.
	 */
	private function has_content( array $block ): bool {
		return null !== $block['blockName'] || '' !== trim( $block['innerHTML'] );
	}

	/**
	 * Returns the white space that separates two top-level blocks.
	 *
	 * @return array The white space, as a block without a name.
	 */
	private function create_separator(): array {
		return array(
			'blockName'    => null,
			'attrs'        => array(),
			'innerBlocks'  => array(),
			'innerHTML'    => "\n\n",
			'innerContent' => array( "\n\n" ),
		);
	}

	/**
	 * Removes the white space a removed block leaves between its neighbours,
	 * before the first block and after the last.
	 *
	 * @param array[] $blocks The top-level blocks.
	 *
	 * @return array[] The blocks, with one separator at most between two.
	 */
	private function remove_extra_separators( array $blocks ): array {
		$kept = array();

		foreach ( $blocks as $block ) {
			$previous = end( $kept );

			if ( ! $this->has_content( $block ) && ( false === $previous || ! $this->has_content( $previous ) ) ) {
				continue;
			}

			$kept[] = $block;
		}

		while ( $kept && ! $this->has_content( end( $kept ) ) ) {
			array_pop( $kept );
		}

		return $kept;
	}

	/**
	 * Saves the blocks as the post's content.
	 *
	 * @param WP_Post $post   The post.
	 * @param array[] $blocks The blocks.
	 *
	 * @return true|WP_Error True, or the error that kept the post from being
	 *                       saved.
	 */
	private function save( WP_Post $post, array $blocks ) {
		/*
		 * WordPress saves a revision of what a post becomes. A post that was
		 * never updated, such as one created by code, has none of what it was:
		 * keep that first, so the change can be undone. It does nothing when
		 * the last revision holds it already.
		 */
		wp_save_post_revision( $post->ID );

		$result = wp_update_post(
			wp_slash(
				array(
					'ID'           => $post->ID,
					'post_content' => serialize_blocks( $blocks ),
				)
			),
			true
		);

		return is_wp_error( $result ) ? $result : true;
	}
}
