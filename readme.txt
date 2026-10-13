=== Mermaid Blocks ===
Contributors:      IvanHryhorenko
Tags:              block, diagrams, mermaidjs, flowchart, gantt, sequence
Tested up to:      7.1
Stable tag:        1.1.0
Requires PHP:      7.4
License:           GPL-3.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-3.0.html

Mermaid Blocks allows you to add and render diagrams using MermaidJS directly in the WordPress editor.

== Description ==

Mermaid Blocks is a Gutenberg plugin that integrates [MermaidJS](https://mermaid-js.github.io/) diagrams into your WordPress posts and pages. It supports popular diagram types such as flowcharts, sequence diagrams, Gantt charts, class diagrams, and more.

This makes it easy to include **text-based diagrams** using MermaidJS syntax in the Gutenberg editor without additional tools or complex setups.

[Playground Demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/land0r/mermaid-blocks/main/blueprint.json)


### Features:
- Add MermaidJS diagrams via a dedicated Gutenberg block.
- **Supported diagram types:** Flowcharts, Sequence Diagrams, Gantt Charts, Class Diagrams.
- Real-time preview of MermaidJS diagrams in the editor.
- Optional controls for visitors: zoom for large diagrams, a fullscreen view, buttons to download a diagram as an SVG or PNG file, and a button that copies its code.
- Every Mermaid theme: one for the whole site under Settings → Mermaid Blocks, and one per diagram where you need it. The automatic theme follows the page, dark mode included.
- Alignment (centre, wide and full width), spacing, and an optional caption.
- A title and a description of each diagram for screen readers.
- Simple and intuitive integration with the block editor.
- A `[mermaid]` shortcode for the classic editor, page builders and text widgets.

### Shortcode:
Where the block can't be used, write the diagram between `[mermaid]` and `[/mermaid]`:

    [mermaid caption="Checkout" zoom download]
    flowchart LR
    A[Cart] --> B{Paid?}
    B -->|Yes| C[Done]
    [/mermaid]

Its attributes are the settings of the block:

- `theme`: a Mermaid theme, such as `forest` or `dark`. Without one, the theme set for the site.
- `caption`: a caption under the diagram.
- `zoom` and `download`: zoom controls and download buttons for visitors. Write them without a value, or as `zoom="1"`.
- `title` and `description`: what screen readers read for the diagram.
- `align`: `center`, `wide` or `full`.

If another plugin already uses `[mermaid]`, write `[mermaid_blocks]` instead: it always belongs to this plugin.

### Abilities for AI agents:
On WordPress 6.9 and later, the plugin registers abilities with the WordPress Abilities API, in the "Mermaid diagrams" category. AI agents and automation can use them to work with diagrams, for example through the MCP Adapter or the REST API under `wp-abilities/v1`:

- `mermaid-blocks/list-diagram-types`: the diagram types with starter code.
- `mermaid-blocks/list-diagrams`: the diagrams in one post, or in every post that has some.
- `mermaid-blocks/get-diagram`: one diagram of a post.
- `mermaid-blocks/build-block-markup`: the block markup of a diagram, for other abilities that write posts.
- `mermaid-blocks/insert-diagram`: adds a diagram to a post.
- `mermaid-blocks/update-diagram`: changes the code or the settings of a diagram.
- `mermaid-blocks/delete-diagram`: removes a diagram from a post.
- `mermaid-blocks/validate-diagram`: parses a diagram in the block editor and reports its errors (WordPress 7.0 and later). The server can't parse Mermaid, so the other abilities don't validate code.

A diagram is addressed by the ID of its post and its index among the post's diagrams. Changes need the hash a read returned, so a diagram edited in the meantime is never overwritten, and every change leaves a revision. Each ability is open only to those who could make the same change in the editor: users work with the diagrams of the posts they can edit.

== Installation ==

1. Upload the plugin to the `/wp-content/plugins/mermaid-blocks` directory, or install it through the WordPress plugin screen.
2. Activate the plugin through the 'Plugins' menu.
3. Add the **Mermaid Diagram** block in the Gutenberg editor.
4. Write MermaidJS code and preview your diagram instantly.

== Frequently Asked Questions ==

= What types of diagrams are supported? =
The plugin supports popular MermaidJS diagrams: Flowcharts, Sequence Diagrams, Gantt Charts, and Class Diagrams.

= Can I edit MermaidJS code? =
Yes, you can edit MermaidJS code directly in the block editor using plain text.

= Is real-time rendering supported? =
Yes, your diagrams are rendered in real-time as you edit the code.

= Does it work on all themes? =
Yes, it is compatible with most modern WordPress themes.

= Can I use it in the classic editor or a page builder? =
Yes, with the `[mermaid]` shortcode: put the Mermaid code between `[mermaid]` and `[/mermaid]`. If a page builder shows the code instead of the diagram, the code has a `<` that WordPress took for the start of a tag: write it as `&lt;`.

== Screenshots ==

1. **Adding a diagram block** – Inserting a Mermaid Diagram block in Gutenberg editor.
2. **Example: Flowchart** – A rendered flowchart in the Gutenberg editor.
3. **Example: Sequence Diagram** – MermaidJS sequence diagram rendered live.
4. **Frontend View** – A Mermaid diagram displayed on the published site.

== Changelog ==

= 1.0.0 =
* Initial stable release.
* Add MermaidJS block with support for flowcharts, sequence diagrams, Gantt charts, and class diagrams.
* Real-time rendering of diagrams in the Gutenberg editor.

= 1.1.0 =
* Instructions in the editor.
* ObsidianMD markdown to Mermaid Blocks transformation.

== Future Plans ==

* Add support for state diagrams, mindmaps, and other MermaidJS types.
* Include pre-designed templates for faster diagram creation.
