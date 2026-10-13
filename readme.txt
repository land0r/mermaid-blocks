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
- Optionally, a saved image of each diagram, for feeds and for browsers that run no JavaScript, which otherwise show its Mermaid code.
- Simple and intuitive integration with the block editor.
- A `[mermaid]` shortcode for the classic editor, page builders and text widgets.
- Optionally, Mermaid code that is already in your posts as code, such as a `language-mermaid` code block from a Markdown import, is shown as a diagram.
- Light on your pages: a page with a diagram loads one small script, then Mermaid when a diagram scrolls into view, and of Mermaid only the parts that diagram needs. A page without a diagram loads nothing.

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

### Mermaid code in posts:
Content that came from Markdown often holds its diagrams as code. Switch on "Show code marked as Mermaid as diagrams" under Settings → Mermaid Blocks, and visitors see that code as diagrams, without anyone converting it:

- a Code block with the additional CSS class `language-mermaid` (under Advanced, in the settings of the block),
- a `<pre>` element with that class, or whose `<code>` element has it, as in `<pre><code class="language-mermaid">`.

The post and the editor keep the code. These diagrams have the theme set for the site, and no controls. To give one its own settings, select the Code block and transform it into a Mermaid Diagram block.

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

### Saved images:
A diagram is drawn in the visitor's browser, so a feed reader, or a browser that runs no JavaScript, shows its Mermaid code instead. Switch on "Save an image of each diagram" under Settings → Mermaid Blocks to give those readers a picture:

- The block editor makes a PNG image of each diagram of a post when the post is opened or saved in it. A post written before gets its images the next time it is opened in the editor.
- Feeds show the image in place of the code. On the site the image is in a `<noscript>` element, so browsers that run JavaScript never load it, and show the live diagram as before.
- An image is of one version of a diagram. When the code or the theme of a diagram is changed anywhere else, through the abilities for example, its image is removed, and those readers see the code again until the post is opened in the editor.
- The text of the image, for those who can't see it, is the description of the diagram, or else its title.
- The images are files in `wp-content/uploads/mermaid-blocks/`. They are deleted with their post, and with the plugin.

The diagrams of synced patterns, template parts, widgets and shortcodes get no image.

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

= How much does a diagram add to a page? =
A page with a diagram gets one script of 8 KB (3.5 KB compressed) and 3.5 KB of styles, and nothing more until a diagram scrolls into view. Then it loads Mermaid, and of Mermaid only what the type of that diagram needs. For a flowchart that is 870 KB of JavaScript, or 240 KB as a server sends it, compressed. Class, state and entity relationship diagrams take as much, sequence diagrams and Gantt charts a little less, and the other types between 190 and 370 KB compressed, except architecture diagrams with 520 KB and use case diagrams with 760 KB. Three quarters of it is the same for every type, so a page with several types loads that part once.

Three things are loaded only for a diagram that uses them: formulas (80 KB compressed), the ELK layout (500 KB) and the controls for visitors (4 KB). A page without a diagram loads nothing from the plugin.

= Can I use the ELK layout? =
Yes, for one diagram at a time. Start its code with these lines:

    ---
    config:
      layout: elk
    ---

Without them, flowcharts and class, state, entity relationship and requirement diagrams get Mermaid's dagre layout. Use case diagrams always get ELK. ELK draws its lines with right angles and often keeps a large diagram tidier, but it is 1.6 MB of JavaScript, twice everything else a flowchart loads, so only the pages with a diagram that asks for it load it.

= What do feed readers and browsers without JavaScript show? =
The Mermaid code of the diagram, since it is the browser that draws it. To show them a picture instead, switch on "Save an image of each diagram" under Settings → Mermaid Blocks, then open your posts in the block editor, which makes the images.

= Can I use it in the classic editor or a page builder? =
Yes, with the `[mermaid]` shortcode: put the Mermaid code between `[mermaid]` and `[/mermaid]`. If a page builder shows the code instead of the diagram, the code has a `<` that WordPress took for the start of a tag: write it as `&lt;`.

= My posts already have Mermaid code in code blocks. Do I have to convert them? =
No. Switch on "Show code marked as Mermaid as diagrams" under Settings → Mermaid Blocks. Code with the `language-mermaid` class is then shown as a diagram, and the posts stay as they are. The diagram replaces the code before the page is sent, so a script of another plugin that draws such code finds none: it is not drawn twice. To keep some code as code, return false from the `mermaid_blocks_show_code_as_diagram` filter.

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
