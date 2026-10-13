let loading = null;

/**
 * Loads the controls of diagrams once per page: the buttons to zoom, to
 * download, to copy the code and to go fullscreen.
 *
 * They are half of the front-end code and most diagrams have none, so they
 * are a file of their own (`build/controls.js`, a module), imported by URL
 * when the first diagram asks for a control.
 *
 * @param {string} url URL of `build/controls.js`.
 *
 * @return {Promise<Function>} `addControls()` of controls.js. Rejects, on
 * every call, when the file could not be loaded.
 */
export default function loadControls( url ) {
	if ( ! loading ) {
		loading = import( /* webpackIgnore: true */ url ).then(
			( { default: addControls } ) => addControls
		);
	}

	return loading;
}
