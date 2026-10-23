/**
 * Draws the saved images of the diagrams of the post being edited.
 *
 * The server keeps an image of each diagram for readers that run no
 * JavaScript, and can't draw one (see SavedImages.php, ImageSync.php and
 * ImagesController.php in includes/Images/). So when a post is opened in the
 * editor, and each time it is saved there, this asks the server which
 * diagrams of the post have no image, draws each as a PNG, and sends it back.
 *
 * The server says what to draw: the code and the theme of the diagrams as
 * they are saved, not as they are being edited. An image is of what readers
 * get.
 */
import apiFetch from '@wordpress/api-fetch';
import { select, subscribe } from '@wordpress/data';

import { getRenderer, hasRenderer } from '../renderers';
import { AUTO_LIGHT, THEMES } from '../utils/themes';
import { getPngBlob, getThemeBackground } from '../utils/export-diagram';
import { getPaletteVariables } from '../utils/pele-palette';

// How long to wait for the editor canvas and its Mermaid when the editor
// opens, and how often to look for them.
const CANVAS_TIMEOUT = 5000;
const CANVAS_INTERVAL = 100;

let counter = 0;

// Whether the canvas was waited for: it loads once, with the editor.
let waited = false;

// The last run for each post, which the next one waits for.
const runs = new Map();

/**
 * Returns the renderer of the editor canvas, once the canvas can be
 * drawn in.
 *
 * The scripts of the canvas run before its document has a body, and Mermaid
 * draws in the body: until the document has loaded, a render fails.
 *
 * @return {Object|null} The renderer of the canvas, or null.
 */
function findCanvasRenderer() {
	const frame = document.querySelector( 'iframe[name="editor-canvas"]' );
	const view = frame && frame.contentWindow;

	if (
		! hasRenderer( view ) ||
		! view.document.body ||
		view.document.readyState !== 'complete'
	) {
		return null;
	}

	return getRenderer( view );
}

/**
 * Returns the renderer to draw the images with: the one of the editor
 * canvas, where the previews are drawn, so an image is measured as they are.
 * The canvas and its scripts load after the editor does, so the first image
 * waits for them. An editor without a canvas of its own has the admin
 * window's Mermaid.
 *
 * @return {Promise<Object|null>} The renderer, which tells the document it
 * draws in, or null when there is none.
 */
async function getCanvasRenderer() {
	const timeout = waited ? 0 : CANVAS_TIMEOUT;

	for ( let elapsed = 0; elapsed < timeout; elapsed += CANVAS_INTERVAL ) {
		if ( findCanvasRenderer() ) {
			break;
		}

		await new Promise( ( resolve ) =>
			setTimeout( resolve, CANVAS_INTERVAL )
		);
	}

	waited = true;

	return findCanvasRenderer() || getRenderer( window );
}

/**
 * Draws a diagram as a PNG.
 *
 * An image has one look, wherever it is shown. A diagram that follows the
 * page is drawn as on a light page, and every image has the background its
 * theme is made for, or, with Pele, its palette's.
 *
 * @param {string} code  The Mermaid source.
 * @param {string} theme The theme of the diagram, as the server names it: one
 *                       of THEMES, or the automatic theme.
 *
 * @return {Promise<Blob|null>} The PNG, or null for a diagram that can't be
 * drawn, such as one with a syntax error.
 */
export async function drawImage( code, theme ) {
	const owner = await getCanvasRenderer();

	if ( ! owner ) {
		return null;
	}

	const drawnTheme = THEMES.includes( theme ) ? theme : AUTO_LIGHT;

	counter += 1;

	const result = await owner.draw(
		code,
		drawnTheme,
		owner.document.body,
		`mermaid-blocks-image-${ counter }`
	);

	if ( result.error ) {
		// eslint-disable-next-line no-console
		console.warn(
			'Mermaid Blocks: a diagram could not be drawn as an image.',
			result.error.message
		);

		return null;
	}

	const template = document.createElement( 'template' );
	template.innerHTML = result.svg;

	const svg = template.content.querySelector( 'svg' );

	if ( ! svg ) {
		return null;
	}

	// A Pele diagram has no colours of its own: the file gets those of its
	// palette, in the look of a light page, and the background to match.
	if ( result.palette ) {
		const variables = getPaletteVariables( result.palette, null );

		return getPngBlob( svg, variables[ '--pele-bg' ], variables );
	}

	return getPngBlob( svg, getThemeBackground( drawnTheme ) );
}

/**
 * Draws and saves the images the diagrams of a post lack, with the renderer of
 * the editor canvas.
 *
 * @param {number} postId The ID of the post.
 *
 * @return {Promise<number>} The number of images saved.
 */
export async function saveImages( postId ) {
	// The server keys an image by the renderer it is drawn with, which only the editor knows.
	const renderer = await getCanvasRenderer();

	if ( ! renderer ) {
		return 0;
	}

	const path = `/mermaid-blocks/v1/posts/${ postId }/images`;
	const query = `?renderer=${ renderer.name }`;
	const { missing = [] } = await apiFetch( { path: path + query } );

	let saved = 0;

	for ( const { key, code, theme } of missing ) {
		const body = await drawImage( code, theme );

		if ( ! body ) {
			continue;
		}

		await apiFetch( {
			path: `${ path }/${ key }${ query }`,
			method: 'POST',
			headers: { 'Content-Type': 'image/png' },
			body,
		} );

		saved += 1;
	}

	return saved;
}

/**
 * Saves the images of a post once the run before it, for the same post, is
 * done, so two runs never draw the same diagram. A run that fails leaves the
 * diagrams without an image, which readers see as code, as before.
 *
 * @param {number} postId The ID of the post.
 *
 * @return {Promise<void>} Resolves when the run is done.
 */
function queueImages( postId ) {
	const run = ( runs.get( postId ) || Promise.resolve() )
		.then( () => saveImages( postId ) )
		.catch( ( error ) => {
			// eslint-disable-next-line no-console
			console.warn(
				'Mermaid Blocks: the images of the diagrams could not be saved.',
				error
			);
		} );

	runs.set( postId, run );

	return run;
}

/**
 * Watches the post being edited: its images are saved when it is opened, and
 * each time it is saved, autosaves aside.
 *
 * @return {Function} Stops watching.
 */
export default function watchPost() {
	let checkedPost = null;
	let wasSaving = false;

	return subscribe( () => {
		/*
		 * By name: importing the store would make the block's script depend on
		 * the post editor, which the widgets editor must not load.
		 */
		// eslint-disable-next-line @wordpress/data-no-store-string-literals
		const editor = select( 'core/editor' );

		if ( ! editor ) {
			return;
		}

		// A template has a name for an ID, and no diagrams of its own to show.
		const postId = editor.getCurrentPostId();

		if ( ! Number.isInteger( postId ) ) {
			return;
		}

		const isSaving = editor.isSavingPost() && ! editor.isAutosavingPost();
		const isSaved =
			wasSaving && ! isSaving && editor.didPostSaveRequestSucceed();

		wasSaving = isSaving;

		if ( isSaved || checkedPost !== postId ) {
			checkedPost = postId;
			queueImages( postId );
		}
	} );
}
