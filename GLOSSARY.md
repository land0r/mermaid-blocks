# Mermaid Blocks

Diagrams written in Mermaid, shown on WordPress pages: in posts through the block, and through the other integrations.

## Diagrams

**Diagram**:
One piece of Mermaid code shown on a page, with its theme, caption, controls and accessible title and description.
_Avoid_: chart, graph, figure

**Mermaid**:
The language a diagram is written in. Never the library that draws it: that is Mermaid.js.
_Avoid_: Mermaid syntax, Mermaid markup

**Code**:
The text of a diagram, in Mermaid. It can set a theme of its own, in its front matter or in a directive.
_Avoid_: source, definition, syntax

**Integration**:
A way a diagram gets into a page: the block, the shortcode, code shown as diagrams, the Elementor widget.

## Drawing

**Renderer**:
The library that draws the code of a diagram as an SVG in the browser: Mermaid.js or Pele. A page draws all its diagrams with one: the one chosen on the settings page, unless code picks another for that page.
_Avoid_: engine, library, diagram library

**Mermaid.js**:
The renderer made by the Mermaid project, and the default. It draws each diagram in one of its named themes.
_Avoid_: Mermaid (for the library)

**Pele**:
The renderer made by Obsidian. It draws faster and loads less than Mermaid.js, in a plain look of its own, with a light and a dark palette.

**Palette**:
The colours Pele draws a diagram in: light or dark. Pele has no named themes, so a theme picks one of the two.

## Looks

**Theme**:
What a diagram is drawn in: Automatic, or one of Mermaid.js's named themes, such as Forest or Neo Dark. With Pele, a theme counts as light or dark by its name, and the settings offer Automatic, Light and Dark (Mermaid.js's Default and Dark); a diagram keeps another theme it had, shown as Light or Dark.
_Avoid_: using "theme" alone for the site's WordPress theme

**Site theme**:
The theme a diagram gets when neither its code nor its settings name one. Set on the settings page.
_Avoid_: default theme (Default is one of the named themes)

**Automatic**:
The theme that follows the page: light on a light surface, dark on a dark one.
_Avoid_: auto, system theme

**Surface**:
What a diagram sits on: the nearest background colour behind it, which is light or dark.
_Avoid_: background (when the page's colour is meant)

## Readers without JavaScript

**Saved image**:
A PNG of a diagram, drawn in the editor and kept with its post, which feeds and browsers that run no JavaScript get instead of the code. It belongs to one code, one theme and one renderer; until it is drawn again, the image of the other renderer stands in.
_Avoid_: thumbnail, fallback image, snapshot
