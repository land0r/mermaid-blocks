# Mermaid Blocks

A WordPress block plugin with one dynamic block, `mermaid-blocks/diagram`. Its attributes are `code`, the Mermaid source, and `zoom` and `download`, which give visitors zoom controls and download buttons. The editor shows a live SVG preview. The server outputs the source in a `<pre>`, and the front end replaces it with an SVG rendered by the bundled Mermaid library.

Supports WordPress 6.6+ and PHP 7.4+ (header of `mermaid-blocks.php`).

## Commands

| Command | What it does |
| --- | --- |
| `npm ci && composer install` | Install dependencies |
| `npm start` | Rebuild `build/` on every change |
| `npm run build` | Production build into `build/` |
| `npm run lint:js` | ESLint on `src/` |
| `npm run lint:css` | Stylelint |
| `npm run lint:php` | PHPCS: WordPress standards, PHP 7.4 compatibility, text domain |
| `composer cbf` | Auto-fix PHPCS issues |
| `npm run format` | Prettier on `src/` |
| `npm run test:unit` | Jest unit tests |
| `npm run plugin-zip` | Release zip, built from the `files` list in `package.json` |

The pre-commit hook runs the three linters. CI (`.github/workflows/ci.yml`) runs all of the above and fails when `build/` doesn't match a fresh build.

To try a change in WordPress, use any local install with this directory in `wp-content/plugins/`, or run `npx @wp-playground/cli@latest start` here.

## Layout

- `mermaid-blocks.php`: registers the block from `build/` and loads Mermaid into the editor iframe.
- `includes/diagram.php`: rendering shared by the block and other integrations. Registers the `mermaid-js` and `mermaid-blocks-diagram` assets, passes the URL of Mermaid's ES module build to the latter, and outputs the diagram markup.
- `src/block.json`: block metadata. It refers to the shared assets by handle.
- `src/edit.js`, `src/components/`: editor UI. `code-input.js` is the code field (line numbers, Tab indentation, the marked error line) and `mermaid-diagram.js` the live preview. `edit.js` has the toggles for the visitors' controls, and a toolbar menu that downloads the preview.
- `src/utils/`: `getMermaid()` returns the Mermaid instance of a given window, `renderDiagram()` renders without throwing, `toSourceLine()` maps Mermaid's error lines back to the source, `getIndentEdit()` works out what Tab and Shift+Tab change, `export-diagram.js` turns a rendered diagram into an SVG or PNG file, and `mermaid-config.js` is the shared config.
- `src/render.php`: the block's server-side markup, built with `includes/diagram.php`.
- `src/view.js`, `src/frontend/`: front-end rendering, for every integration. Each diagram renders when it scrolls into view, and `load-mermaid.js` loads Mermaid when the first one does. `controls.js` then adds the buttons the diagram asks for, and `zoom.js` zooms and pans it. `view.js` is an explicit entry in `webpack.config.js`, because `block.json` refers to it by handle.
- `src/save.js` returns `null` because the block is dynamic. `src/deprecated.js` migrates older saved markup.
- `src/transforms.js`: turns selected blocks holding a fenced `mermaid` code block (for example, pasted from Obsidian) into a diagram block.
- `src/variations/`: one variation per diagram type, with starter code.
- `build/`: generated, but committed.
- `.wordpress-org/`: plugin directory banners, icons and screenshots. Not part of the zip.

## Invariants

None of these is obvious from the code, and each has broken before.

- **The editor canvas is an iframe.** Previews must render with the Mermaid copy loaded in that iframe, found with `getMermaid( element.ownerDocument.defaultView )`. Rendering in the parent window measures labels against the wrong CSS. Don't import `mermaid` into the editor bundle: it is the separate `mermaid-js` script (`build/mermaid.min.js`), wired up in `block.json` and `mermaid-blocks.php`.
- **The front end loads Mermaid on demand.** `load-mermaid.js` imports Mermaid's ES module build (`build/mermaid/`) by URL at runtime, so it's never bundled, and the build loads each diagram type's code on first use. Don't make the `mermaid-blocks-diagram` script depend on `mermaid-js`. `webpack.config.js` copies the build with `.mjs` renamed to `.js`, because not every server serves `.mjs` as JavaScript, and fails if an import it can't rewrite is left.
- **One Mermaid config.** The editor and the front end share `src/utils/mermaid-config.js`, so the preview matches the published diagram. Don't set `htmlLabels: false`: SVG text labels show `&amp;` literally and drop `>` (#7).
- **The escaping in `mermaid_blocks_get_diagram_source_markup()` is deliberate.** `esc_textarea()` round-trips the source exactly, and `[` and `]` become `&#91;` and `&#93;` so `do_shortcode()` doesn't expand diagram text such as `A[gallery]`. Don't switch to `esc_html()` or drop the bracket encoding.
- **Saved markup is versioned.** When the output of `save.js` or the block's attributes change, add an entry to `deprecated.js` with a test. Without one, existing posts show "This block contains unexpected or invalid content".
- **`renderDiagram()` never throws.** It returns `{ svg }` or `{ error: { message, line } }`, and it removes the elements Mermaid leaves in the document after a failed render. Callers rely on that contract.
- **Error lines are lines of the source, not Mermaid's.** Mermaid removes the front matter, directives, comment lines and leading blank lines before parsing, and numbers the lines that are left. `toSourceLine()` applies the same removals to map a line back, so it mirrors `preprocessDiagram()` of the pinned Mermaid version. Mermaid's own "Parse error on line N" is dropped from the message for the same reason.
- **Tab in the code field must not trap the keyboard.** Tab and Shift+Tab indent and outdent, and Escape lets the next Tab move focus; the field's help text says so. The handler runs in the capture phase, because the block editor's own Tab handler, on an ancestor, moves focus out of the block unless the key is already handled.
- **Zooming is scrolling.** A zoomed diagram is an SVG wider than its canvas, and the canvas scrolls, so panning by touch, trackpad, scrollbar and arrow keys is the browser's own. `zoom.js` only adds dragging with a mouse, and zooming with Ctrl or Cmd and the wheel. The wheel alone must always scroll the page.
- **A downloaded diagram states its own size.** On the page, a diagram's size follows the page's width and the zoom. `getSvgMarkup()` gives the file the size of the `viewBox` instead. The PNG is drawn from that SVG in a `data:` URL: from a `blob:` URL, Chromium refuses to read back a canvas that an SVG with HTML labels was drawn on.
- **The front-end script has no dependencies**, not even `wp-i18n`. The labels of its buttons are translated in `includes/diagram.php` and passed in `mermaidBlocksSettings`.
- **`build/` is committed** because the Playground blueprint (`blueprint.json`) installs the plugin straight from this repository. Never edit it by hand: run `npm run build` and commit the result together with the source change.
- **Mermaid is pinned to an exact version** in `package.json`. An upgrade needs a check of the bundle sizes (`build/mermaid.min.js` and `build/mermaid/`), of security advisories, of every diagram type in both the editor and the front end, and of the error line mapping against what the new version removes before parsing.
- **The version lives in four places**, which must match: the `mermaid-blocks.php` header, "Stable tag" in `readme.txt`, `package.json` and `src/block.json`.

## Reusing the renderer

The block is one integration of a shared renderer, so other editors, such as a shortcode or a page builder widget, can output the same diagrams. An integration:

1. Outputs `mermaid_blocks_get_diagram_markup( $code, $attributes )`: a `.mermaid-blocks-diagram` wrapper around the escaped source. It also enqueues the assets.
2. Declares the `mermaid-blocks-diagram` script and style handles as its dependencies if it renders outside a normal page load, such as over AJAX, where enqueueing has no effect.
3. Calls `window.mermaidBlocks.render( element )` for diagrams added after the page loaded, such as a widget a page builder re-renders in its preview. Each one renders when it scrolls into view. Already rendered diagrams are skipped.
4. Passes `'data-mermaid-controls' => 'zoom download'`, or one of the two, in `$attributes` to give visitors the zoom controls and the download buttons. Without the attribute a diagram gets neither.

Page builder previews are iframes, like the block editor canvas: load the assets into the preview and call `render()` from inside it.

## Conventions

- WordPress coding standards throughout. The linters are the source of truth.
- Every user-facing string is translatable with the `mermaid-blocks` text domain. ESLint and PHPCS enforce it.
- Unit tests live next to the code they cover, in `test/` directories.
- Commit subjects start with `FEATURE:`, `FIX:` or `UPDATE:`.

## Workflow

- Branch from `main`. `main` is protected: changes land through a reviewed pull request, and commits must be signed.
- Agents may push feature branches and open draft pull requests that link their issue (`Fixes #N`). Agents never push to `main`, force-push or merge.
- The changelog lives only in `readme.txt` and is written at release time from the merged pull requests. Pull requests don't add changelog entries, and there is no `CHANGELOG.md`.

## Definition of done

- `npm run lint:js`, `npm run lint:css`, `npm run lint:php` and `npm run test:unit` pass.
- Every bug fix comes with a test that fails without it.
- `build/` is rebuilt and committed whenever `src/` changed.
- Anything that changes rendering has been checked in the editor and on the front end.
