# Pele as a site-wide second renderer

Mermaid.js stays the default renderer, and Pele, which draws the same Mermaid code in a fraction of the time and download, is the other choice, made for the whole site on the settings page; a filter lets code pick the other one for a request. A page loads one renderer, never both: there is no renderer per diagram, and a diagram Pele can't draw fails as a syntax error does, rather than falling back to Mermaid.js. Pele has no named themes, so with Pele a theme, chosen or written in the code, counts as light or dark by its name, and Pele draws it in its light or its dark palette.

## Considered Options

- **A renderer per diagram.** Rejected: a page with diagrams of both would load both, which undoes what Pele is for, and every integration would need the setting.
- **Falling back to Mermaid.js when Pele fails.** Rejected for the same reason, and because the author would not see that Pele can't draw the diagram: the editor shows Pele's error instead.
- **Pele palettes imitating each Mermaid.js theme.** Left out: eleven palettes to keep in step with Mermaid.js, for a renderer chosen for its own plain look.

## Consequences

- Saved images name their renderer in their key, for Pele only, so existing images keep working. After a switch, the image of the other renderer stands in until the post is opened in the editor again.
- Pele follows one version of Mermaid's syntax, so Mermaid.js and Pele are upgraded together.
