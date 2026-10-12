---
paths:
  - "includes/diagram.php"
  - "src/block.json"
  - "src/save.js"
  - "src/deprecated.js"
  - "src/render.php"
  - "src/view.js"
  - "src/frontend/**"
---

# Diagram markup

Existing posts store this block's attributes and saved markup, and visitors' browsers render whatever the server outputs, for the block and for every other integration. When you change these files:

- **Saved markup or attributes changed** (`save.js`, the `attributes` in `block.json`): add a deprecation to `deprecated.js`, newest first, with a test that migrates the old markup.
- **Server markup changed** (`includes/diagram.php`, `render.php`): `src/frontend/render-diagrams.js` finds diagrams by `.mermaid-blocks-diagram` and `.mermaid-blocks-diagram__source`, and `src/style.scss` styles them. Keep all three in step, update `src/frontend/test/`, and update "Reusing the renderer" in `AGENTS.md` if the contract changes.
- **Check the result** in the editor and on the front end, with a valid diagram, one with a syntax error, and one whose labels contain `& < > " ' [ ]`.
- **`block.json` changed**: run `npm run build`. WordPress reads `build/block.json`, not the copy in `src/`.
