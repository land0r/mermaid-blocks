/**
 * The event a diagram element gets when its SVG was drawn again in place (see
 * redrawInPlace()). It is a DOM event because view.js and controls.js are
 * bundles of their own and share no module state. It doesn't bubble.
 */
export const REDRAWN_EVENT = 'mermaid-blocks:redrawn';
