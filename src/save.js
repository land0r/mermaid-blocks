/**
 * The block is dynamic: the front-end markup is produced by `Block::render()`
 * in `includes/Block.php`, so nothing is saved to `post_content` except the
 * block comment delimiter (which holds the `code` attribute).
 *
 * @see ./deprecated.js for the previous static markup.
 *
 * @return {null} Nothing is saved.
 */
export default function save() {
	return null;
}
