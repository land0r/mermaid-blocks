---
paths:
  - "src/block.json"
  - "src/save.js"
  - "src/deprecated.js"
  - "src/render.php"
  - "src/view.js"
  - "src/frontend/**"
---

# Block markup

Existing posts store this block's attributes and saved markup, and visitors' browsers render whatever `render.php` outputs. When you change these files:

- **Saved markup or attributes changed** (`save.js`, the `attributes` in `block.json`): add a deprecation to `deprecated.js`, newest first, with a test that migrates the old markup.
- **Server markup changed** (`render.php`): `src/frontend/render-blocks.js` finds blocks by `.wp-block-mermaid-blocks-diagram` and `.mermaid-blocks-diagram__source`. Keep them in step and update `src/frontend/test/`.
- **Check the result** in the editor and on the front end, with a valid diagram, one with a syntax error, and one whose labels contain `& < > " ' [ ]`.
- **`block.json` changed**: run `npm run build`. WordPress reads `build/block.json`, not the copy in `src/`.
