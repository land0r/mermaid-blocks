---
paths:
  - "includes/Diagram.php"
  - "includes/Integrations/Block.php"
  - "includes/Integrations/Elementor/**"
  - "includes/Posts/PostDiagrams.php"
  - "src/block.json"
  - "src/save.js"
  - "src/deprecated.js"
  - "src/view.js"
  - "src/frontend/**"
  - "src/style.scss"
---

# Diagram markup

Existing posts store this block's attributes and saved markup, and visitors' browsers render whatever the server outputs, for the block and for every other integration. When you change these files:

- **Saved markup or attributes changed** (`save.js`, the `attributes` in `block.json`): add a deprecation to `deprecated.js`, newest first, with a test that migrates the old markup. A new attribute the abilities may set also goes in `PostDiagrams::ATTRIBUTES`, with its description in `Abilities\Schemas`.
- **Server markup changed** (`includes/Diagram.php`, `Block::render()`): `src/frontend/render-diagrams.js` finds diagrams by `.mermaid-blocks-diagram` and `.mermaid-blocks-diagram__source`, and `src/style.scss` styles them. Keep all three in step, update `src/frontend/test/`, and update "Reusing diagrams in integrations" in `AGENTS.md` if the contract changes.
- **State classes changed** (`is-pending`, `is-rendered`, `has-error`): `src/view.js` and `render-diagrams.js` set them, and `src/style.scss` uses them to decide when the source is visible. A diagram must never stay hidden after it failed.
- **Controls changed** (the `data-mermaid-controls` attribute, with any of `Diagram::CONTROLS`: `zoom`, `download`, `copy`, `fullscreen`): `Diagram::get_data_attributes()` writes it, for `Block::render()` from the block's attributes of the same names and for `Diagram::render()` from settings under those names, which the shortcode and the Elementor widget pass; other integrations pass it themselves, and `src/frontend/controls.js` reads it. `src/view.js` loads that file, `build/controls.js`, only for a diagram whose attribute lists something. A diagram without the attribute gets no controls, so pages cached before an update stay as they were.
- **Theme changed** (the `data-mermaid-theme` attribute): `Block::render()` and `Diagram::get_markup()` write the diagram's theme, or else the site's, and `render-diagrams.js` reads it. A diagram without the attribute follows the page. The canvas has the same attribute for what it was drawn in, `auto-light` or `auto-dark` for a diagram that follows the page: `src/view.js` compares the two to know when to draw again. The themes are listed in `includes/Themes.php` and in `src/utils/themes.js`: change both, and `src/utils/test/themes.js` tells when they differ.
- **Text for assistive technology changed** (`data-mermaid-title`, `data-mermaid-description`): `Diagram::get_data_attributes()` writes them, for the block and the shortcode, and `src/utils/accessible-text.js` puts them into the SVG, on the front end and in the editor's preview.
- **Saved image changed** (the `has-image` class, `.mermaid-blocks-diagram__image`): `Block::render()` asks `SavedImages::find()` for the image of the diagram, and `Diagram::wrap()` puts the `<img>` of `Diagram::get_image_markup()` in a `<noscript>` element before the source, or in place of the source where `SavedImages::replaces_source()` says so, as in a feed. `src/style.scss` sizes the image, and hides the source next to it under `@media (scripting: none)`. A diagram without an image must come out exactly as it did before.
- **Caption changed**: a diagram with a caption is a `<figure>`, and the canvas goes in place of the source, above the `<figcaption>`.
- **Check the result** in the editor and on the front end, with a valid diagram, one with a syntax error, and one whose labels contain `& < > " ' [ ]`.
- **`block.json` changed**: run `npm run build`. WordPress reads `build/block.json`, not the copy in `src/`.
