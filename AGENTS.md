# Mermaid Blocks

A WordPress block plugin with one dynamic block, `mermaid-blocks/diagram`. Its attributes are `code`, the Mermaid source; `zoom` and `download`, which give visitors zoom controls and download buttons; `theme`, the theme the diagram is drawn in; `caption`; and `accTitle` and `accDescr`, a title and a description for assistive technology. It supports alignment (centre, wide, full) and spacing. The editor shows a live SVG preview. The server outputs the source in a `<pre>`, and the front end replaces it with an SVG rendered by the bundled Mermaid library.

The `[mermaid]` shortcode outputs the same diagrams where the block can't be used: the classic editor, page builders, text widgets.

Supports WordPress 6.6+ and PHP 7.4+ (header of `mermaid-blocks.php`).

## Commands

| Command | What it does |
| --- | --- |
| `npm ci && composer install` | Install dependencies, and generate Composer's autoloader in `vendor/` |
| `npm start` | Rebuild `build/` on every change |
| `npm run build` | Production build into `build/` |
| `npm run lint:js` | ESLint on `src/` |
| `npm run lint:css` | Stylelint |
| `npm run lint:php` | PHPCS: WordPress standards, PHP 7.4 compatibility, text domain |
| `composer cbf` | Auto-fix PHPCS issues |
| `npm run format` | Prettier on `src/` |
| `npm run test:unit` | Jest unit tests |
| `npm run test:php` | PHPUnit tests, on WordPress's test library. They need a MySQL database of their own: its tables are dropped. Set `WP_TESTS_DB_NAME`, `WP_TESTS_DB_USER`, `WP_TESTS_DB_PASSWORD` and `WP_TESTS_DB_HOST` (defaults: `wordpress_tests`, `root`, empty, `127.0.0.1`) |
| `npm run plugin-zip` | Release zip: a fresh build, the autoloader without development dependencies, and the `files` listed in `package.json` |

The pre-commit hook runs the three linters. CI (`.github/workflows/ci.yml`) runs the linters and both test suites, the PHP one on a MySQL service and again on PHP 7.4, makes the release zip, checks that it holds the build and an autoloader that loads every class, and attaches it to the run.

`build/` and `vendor/` are generated and not committed. To try a change in WordPress, run `composer install` and `npm run build`, then use any local install with this directory in `wp-content/plugins/`, or run `npx @wp-playground/cli@latest start` here.

## Layout

- `mermaid-blocks.php`: loads Composer's autoloader and starts the plugin with `mermaid_blocks()->init()`. Without the autoloader or the build, it shows a notice instead.
- `includes/`: the PHP classes, in the `MermaidBlocks` namespace, one per file named after the class. Composer autoloads them (PSR-4).
  - `Plugin`: creates the other parts and adds their hooks. `mermaid_blocks()`, in `functions.php`, returns its one instance, which gives access to each part.
  - `Assets`: registers the `mermaid-js` and `mermaid-blocks-diagram` assets from `build/`, and passes the URL of Mermaid's ES module build and the translated labels to the latter.
  - `Block`: registers the block from `build/` and renders it, loads Mermaid into the editor iframe, and tells the editor the themes and the site's theme for diagrams.
  - `Shortcode`: the `[mermaid]` shortcode, and `[mermaid_blocks]`, the tag no other plugin takes. It reads the Mermaid source back out of what the content filters made of it, and outputs it through `Diagram`.
  - `Diagram`: the diagram markup, shared by the block and other integrations, and the theme a diagram is drawn in.
  - `Themes`: the themes a diagram can be drawn in.
  - `Settings`: the settings page, Settings > Mermaid Blocks. Its one setting is the theme of diagrams that have none of their own, stored in the `mermaid_blocks_theme` option, which `uninstall.php` deletes.
  - `DiagramTypes`: the diagram types with starter code, the one source of the block's variations and of the `list-diagram-types` ability, and the detection of a diagram's type from its first keyword.
  - `PostDiagrams`: the diagrams in the content of posts. It finds them by index, creates diagram blocks, and adds, replaces and removes them.
  - `Abilities/`: the abilities of the WordPress Abilities API (WordPress 6.9+), one class per ability. `Ability` is the abstract base: a subclass defines the name, texts, schemas, annotations, permission check and execute callback, and `get_args()` puts them together for `wp_register_ability()`. `DiagramAbility` is the base of the abilities that work on diagrams, with their shared schemas and permission check. `AbilitiesRegistrar` registers the abilities `Plugin` gives it, and their `mermaid-blocks` category, and loads the client-side abilities in the block editor.
- `src/abilities/`: the abilities that run in the browser, a script module (WordPress 7.0+): `mermaid-blocks/validate-diagram` parses a diagram with the editor's Mermaid. The server can't parse Mermaid.
- `src/block.json`: block metadata. It refers to the shared assets by handle.
- `src/edit.js`, `src/components/`: editor UI. `code-input.js` is the code field (line numbers, Tab indentation, the marked error line) and `mermaid-diagram.js` the live preview. `edit.js` has the theme, the toggles for the visitors' controls, the accessible title and description, the caption, and a toolbar menu that downloads the preview.
- `src/utils/`: `getMermaid()` returns the Mermaid instance of a given window, `renderDiagram()` renders in a theme without throwing, `toSourceLine()` maps Mermaid's error lines back to the source, `getIndentEdit()` works out what Tab and Shift+Tab change, `export-diagram.js` turns a rendered diagram into an SVG or PNG file, and `mermaid-config.js` is the shared config. For themes: `themes.js` lists them, and turns the theme a diagram asks for into what it is drawn in (`resolveTheme()`) and into Mermaid configuration (`getThemeConfig()`); `getSurface()` tells whether an element sits on something dark; `watchSurface()` tells when that may have changed. `accessible-text.js` writes a title and a description into a rendered SVG.
- `src/view.js`, `src/frontend/`: front-end rendering, for every integration. Each diagram renders when it scrolls into view, and `load-mermaid.js` loads Mermaid when the first one does. `controls.js` then adds the buttons the diagram asks for, and `zoom.js` zooms and pans it. A diagram that follows the page is drawn again when the page turns dark or light. `view.js` is an explicit entry in `webpack.config.js`, because `block.json` refers to it by handle.
- `src/save.js` returns `null` because the block is dynamic. `src/deprecated.js` migrates older saved markup.
- `src/transforms.js`: turns selected blocks holding a fenced `mermaid` code block (for example, pasted from Obsidian) into a diagram block.
- `tests/`: the PHPUnit tests, with WordPress from Composer (`vendor/roots/wordpress-no-content/`) and its test library (`wp-phpunit/wp-phpunit`).
- `build/`: generated by `npm run build`. `vendor/`: generated by `composer install`. Neither is committed.
- `.wordpress-org/`: plugin directory banners, icons and screenshots. Not part of the zip.

## Invariants

None of these is obvious from the code, and each has broken before.

- **The editor canvas is an iframe.** Previews must render with the Mermaid copy loaded in that iframe, found with `getMermaid( element.ownerDocument.defaultView )`. Rendering in the parent window measures labels against the wrong CSS. Don't import `mermaid` into the editor bundle: it is the separate `mermaid-js` script (`build/mermaid.min.js`), wired up in `block.json`, `includes/Assets.php` and `includes/Block.php`.
- **The front end loads Mermaid on demand.** `load-mermaid.js` imports Mermaid's ES module build (`build/mermaid/`) by URL at runtime, so it's never bundled, and the build loads each diagram type's code on first use. Don't make the `mermaid-blocks-diagram` script depend on `mermaid-js`. `webpack.config.js` copies the build with `.mjs` renamed to `.js`, because not every server serves `.mjs` as JavaScript, and fails if an import it can't rewrite is left.
- **One Mermaid config.** The editor and the front end share `src/utils/mermaid-config.js`, so the preview matches the published diagram. Don't set `htmlLabels: false`: SVG text labels show `&amp;` literally and drop `>` (#7).
- **The escaping in `Diagram::get_source_markup()` is deliberate.** `esc_textarea()` round-trips the source exactly, and `[` and `]` become `&#91;` and `&#93;` so `do_shortcode()` doesn't expand diagram text such as `A[gallery]`. Don't switch to `esc_html()` or drop the bracket encoding. The wrapper's attributes get the same encoding (`Diagram::encode_brackets()`): `do_shortcode()` also expands shortcodes inside attribute values, such as an accessible title.
- **A shortcode gets its content after the content filters.** `wpautop()` has ended each line with `<br />` and wrapped what blank lines separate in `<p>`, and the editors and kses store `>`, `<` and `&` as entities. `Shortcode::get_code()` undoes exactly that, and keeps a `<br>` in the middle of a line, which is a line break in a label. Those filters, and `do_shortcode()` itself, also take everything from a `<` to the next `>` for a tag: a class diagram ending with `Animal <|-- Duck` would hide the shortcode's closing tag in one. So `Shortcode::protect_code()` runs before them, on the filters that run shortcodes in content, and writes the `<` and `>` of the code as entities. Code passed straight to `do_shortcode()`, as some page builders do, doesn't get that: there a `<` needs a `>` after it, or has to be written as `&lt;`. `wptexturize()` is kept away with `no_texturize_shortcodes`, only for the tags that are the plugin's at that moment: `[mermaid]` is registered late and only when it is free, so another plugin that has it keeps it.
- **Saved markup is versioned.** When the output of `save.js` or the block's attributes change, add an entry to `deprecated.js` with a test. Without one, existing posts show "This block contains unexpected or invalid content".
- **The transform is asked about every block.** `src/transforms.js` registers it for `*`, so `isMatch` gets the attributes of whatever is selected: blocks with no `content`, or with something other than text in it. An exception there takes the whole editor down when the Transform menu opens (#6).
- **A theme is set per render, and renders take turns.** Mermaid has one configuration per window and no theme per render. `renderDiagram()` initialises Mermaid again when the theme changes, and queues the renders of each Mermaid instance, because Mermaid reads its configuration all through a render. Don't call `mermaid.initialize()` or `mermaid.render()` anywhere else once diagrams render.
- **The themes are listed twice.** `Themes::get_all()` in `includes/Themes.php` has their names and labels, which the settings page and the editor show, and `THEMES` in `src/utils/themes.js` has the names for the front end. Both list every theme of the bundled Mermaid, except `null`, which only removes a diagram's colours. `src/utils/test/themes.js` compares the two lists with each other and with Mermaid's.
- **Automatic is not Mermaid's `default` theme.** Given no theme, Mermaid 12 picks one per diagram type: `redux-color` for flowcharts, sequence, class, state and ER diagrams and a few more, `default` for the rest. `auto-light` names no theme, so diagrams look as they did before they could have one. `auto-dark` names the dark counterpart of each of those picks, read from `mermaidAPI.defaultConfig` (`getThemeConfig()`). Naming `default` gives every type the classic look instead.
- **A diagram that follows the page reads its surface, not the system.** `getSurface()` looks for the nearest background colour behind the diagram, and falls back to the colour of the text. `prefers-color-scheme` alone says nothing about a page: most themes are light whatever the system is. The block editor gives a block around a diagram its colours only after the preview first rendered, so `mermaid-diagram.js` watches the elements around the preview and draws again.
- **`renderDiagram()` never throws.** It returns `{ svg }` or `{ error: { message, line } }`, and it removes the elements Mermaid leaves in the document after a failed render. Callers rely on that contract.
- **Error lines are lines of the source, not Mermaid's.** Mermaid removes the front matter, directives, comment lines and leading blank lines before parsing, and numbers the lines that are left. `toSourceLine()` applies the same removals to map a line back, so it mirrors `preprocessDiagram()` of the pinned Mermaid version. Mermaid's own "Parse error on line N" is dropped from the message for the same reason.
- **Tab in the code field must not trap the keyboard.** Tab and Shift+Tab indent and outdent, and Escape lets the next Tab move focus; the field's help text says so. The handler runs in the capture phase, because the block editor's own Tab handler, on an ancestor, moves focus out of the block unless the key is already handled.
- **Zooming is scrolling.** A zoomed diagram is an SVG wider than its canvas, and the canvas scrolls, so panning by touch, trackpad, scrollbar and arrow keys is the browser's own. `zoom.js` only adds dragging with a mouse, and zooming with Ctrl or Cmd and the wheel. The wheel alone must always scroll the page.
- **A downloaded diagram states its own size.** On the page, a diagram's size follows the page's width and the zoom. `getSvgMarkup()` gives the file the size of the `viewBox` instead. The PNG is drawn from that SVG in a `data:` URL: from a `blob:` URL, Chromium refuses to read back a canvas that an SVG with HTML labels was drawn on.
- **The front-end script has no dependencies**, not even `wp-i18n`. The labels of its buttons are translated in `includes/Assets.php` and passed in `mermaidBlocksSettings`.
- **`build/` and `vendor/` are generated, and only releases ship them.** A copy of the repository can't run until `composer install` and `npm run build` ran: `mermaid-blocks.php` checks for both and shows a notice instead of loading. The Playground blueprint (`blueprint.json`) installs the zip attached to the latest GitHub release, so each release needs `mermaid-blocks.zip` attached. Never edit `build/` by hand.
- **The release zip gets the production autoloader.** `npm run plugin-zip` installs Composer's packages without development dependencies before it zips `vendor/`, then installs them again. Zipping `vendor/` any other way ships PHPCS.
- **Classes are autoloaded, so a class's file is named after it.** Composer maps `MermaidBlocks\` to `includes/`. A new class needs no `require`, but its file name must match the class name, case included: macOS doesn't mind a mismatch, Linux servers do. `includes/functions.php` holds the only global function, `mermaid_blocks()`, and `mermaid-blocks.php` requires it.
- **A diagram in a post is addressed by its index and its hash.** Blocks have no ids. The index counts the diagram blocks of a post in document order, nested ones included, from 0, and the hash is the MD5 of the serialized block. `PostDiagrams` refuses a change whose hash doesn't match (409), so an edit made in the meantime, or another diagram moving to that index, is never overwritten. Removing a nested block also removes its `null` from the parent's `innerContent`, or the parent no longer serializes.
- **Writes go through `wp_update_post()`, after `wp_save_post_revision()`.** WordPress saves a revision of what a post becomes, so a post that was never updated has no revision of what it was. Saving one first makes every change by an ability undoable from the revisions screen.
- **The abilities' permissions are the editor's.** A user works with the diagrams of the posts they may edit (`edit_post`): contributors their drafts, authors their own posts, editors and administrators all, subscribers and visitors none. Reading needs the same, because it returns the source. Only post types edited in the block editor are reached, and not posts in the trash.
- **Read-only abilities run over GET.** The REST API picks the method from the annotations: GET for `readonly`, DELETE for `destructive` and `idempotent`, POST otherwise. An ability that changes its annotations changes how clients call it.
- **The client-side abilities are a script module.** `@wordpress/abilities` exists only as a module, so `src/abilities/` is built by the module half of `wp-scripts build --experimental-modules`, and `webpack.config.js` tells it to import the two WordPress modules rather than bundle them. A module can't read translations: `AbilitiesRegistrar` passes its texts as script module data. With the flag, wp-scripts no longer empties `build/`, so `npm run build` does it first (`prebuild`).
- **The variations come from PHP.** `Block` registers them with a `variation_callback` from `DiagramTypes`, so the editor and the `list-diagram-types` ability show the same starter code. Don't add variations in JavaScript.
- **The attributes are listed twice.** `src/block.json` defines them, and `PostDiagrams::ATTRIBUTES` lists those the abilities may set, with their types. A new attribute needs both, and the schema in `DiagramAbility::get_attributes_schema()`.
- **Mermaid is pinned to an exact version** in `package.json`. An upgrade needs a check of the bundle sizes (`build/mermaid.min.js` and `build/mermaid/`), of security advisories, of every diagram type in both the editor and the front end, of the error line mapping against what the new version removes before parsing, and of its themes: the unit tests fail when it adds one, or picks one per diagram type that has no dark counterpart in `src/utils/themes.js`.
- **The minimum PHP version lives in four places**, which must match: "Requires PHP" in the `mermaid-blocks.php` header (and `readme.txt`), `testVersion` in `phpcs.xml`, `config.platform.php` in `composer.json`, and the `php-minimum` job in `ci.yml`. Composer resolves the lock for that version, so it installs on every PHP the plugin supports. Without it, a lock made on a newer PHP picks packages CI's PHP can't install.
- **The version lives in four places**, which must match: the `mermaid-blocks.php` header, "Stable tag" in `readme.txt`, `package.json` and `src/block.json`.

## Reusing the renderer

The block and the shortcode are two integrations of a shared renderer, so other editors, such as a page builder widget, can output the same diagrams. An integration:

1. Outputs `mermaid_blocks()->diagram()->get_markup( $code, $attributes, $caption )`: a `.mermaid-blocks-diagram` wrapper around the escaped source, a `<figure>` when there is a caption. It also enqueues the assets. Check `function_exists( 'mermaid_blocks' )` first: the plugin may be inactive.
2. Declares the `mermaid-blocks-diagram` script and style handles as its dependencies if it renders outside a normal page load, such as over AJAX, where enqueueing has no effect.
3. Calls `window.mermaidBlocks.render( element )` for diagrams added after the page loaded, such as a widget a page builder re-renders in its preview. Each one renders when it scrolls into view. Already rendered diagrams are skipped.
4. Passes `'data-mermaid-controls' => 'zoom download'`, or one of the two, in `$attributes` to give visitors the zoom controls and the download buttons. Without the attribute a diagram gets neither.
5. Passes `'data-mermaid-theme'`, a name from `Themes::get_all()`, to draw the diagram in a theme of its own. Without it the diagram gets the site's theme. An integration that builds the wrapper itself, as the block does, gets that theme from `Diagram::get_theme()` and outputs the wrapper with `Diagram::wrap()`; a wrapper without the attribute follows the page.
6. Passes `'data-mermaid-title'` and `'data-mermaid-description'` to give the rendered SVG a title and a description for assistive technology, and the `aligncenter` class to centre a diagram narrower than its column.

Page builder previews are iframes, like the block editor canvas: load the assets into the preview and call `render()` from inside it.

## Conventions

- WordPress coding standards throughout. The linters are the source of truth.
- Every user-facing string is translatable with the `mermaid-blocks` text domain. ESLint and PHPCS enforce it.
- PHP code lives in classes in `includes/`. A class adds its hooks in a `hooks()` method, which `Plugin::init()` calls, never in its constructor, and gets the other parts it needs through its constructor.
- JavaScript unit tests live next to the code they cover, in `test/` directories. PHP tests live in `tests/`, one class per class under test, extending `WP_UnitTestCase`.
- A new ability is a class in `includes/Abilities/` extending `Ability`, or `DiagramAbility` when it works on diagrams. `Plugin` creates it and passes it to `AbilitiesRegistrar`.
- Commit subjects start with `FEATURE:`, `FIX:` or `UPDATE:`.

## Workflow

- Branch from `main`. `main` is protected: changes land through a reviewed pull request, and commits must be signed.
- Agents may push feature branches and open draft pull requests that link their issue (`Fixes #N`). Agents never push to `main`, force-push or merge.
- The changelog lives only in `readme.txt` and is written at release time from the merged pull requests. Pull requests don't add changelog entries, and there is no `CHANGELOG.md`.

## Definition of done

- `npm run lint:js`, `npm run lint:css`, `npm run lint:php`, `npm run test:unit` and `npm run test:php` pass.
- Every bug fix comes with a test that fails without it.
- Anything that changes rendering has been checked in the editor and on the front end.
