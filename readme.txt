=== Mermaid Blocks ===
Contributors:      land0r
Tags:              diagrams, mermaid, flowchart, block, gantt
Requires at least: 6.6
Tested up to:      7.1
Stable tag:        2.0.0
Requires PHP:      7.4
License:           GPL-3.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-3.0.html

Draw Mermaid diagrams in the block editor, with a live preview: flowcharts, sequence, class and Gantt diagrams, mind maps and more.

== Description ==

Mermaid Blocks adds [Mermaid](https://mermaid.js.org/) diagrams to your WordPress posts and pages. You write a diagram as text, in Mermaid's syntax, and the plugin draws it: flowcharts, sequence, class, state and Gantt diagrams, mind maps, timelines, Git graphs, architecture diagrams and every other type Mermaid has.

This makes it easy to include **text-based diagrams** in the block editor without additional tools or complex setups.

[Playground Demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/land0r/mermaid-blocks/main/blueprint.json)


### Features:
- Add Mermaid diagrams with a dedicated block.
- **Every diagram type of Mermaid 12**, with starter code for flowcharts, sequence, class and state diagrams and mind maps.
- Real-time preview of diagrams in the editor, and the line of an error marked in the code.
- Optional controls for visitors: zoom for large diagrams, a fullscreen view, buttons to download a diagram as an SVG or PNG file, and a button that copies its code.
- Every Mermaid theme: one for the whole site under Settings → Mermaid Blocks, and one per diagram where you need it. The automatic theme follows the page, dark mode included.
- Alignment (centre, wide and full width), spacing, and an optional caption.
- A title and a description of each diagram for screen readers.
- Optionally, a saved image of each diagram, for feeds and for browsers that run no JavaScript, which otherwise show its Mermaid code.
- Simple and intuitive integration with the block editor.
- A Mermaid Diagram widget for Elementor, with the block's settings and a live preview.
- A `[mermaid]` shortcode for the classic editor, page builders and text widgets.
- Optionally, Mermaid code that is already in your posts as code, such as a `language-mermaid` code block from a Markdown import, is shown as a diagram.
- Light on your pages: a page with a diagram loads one small script, then Mermaid when a diagram scrolls into view, and of Mermaid only the parts that diagram needs. A page without a diagram loads nothing.
- A choice of renderer: Mermaid.js, or Pele, which draws the same Mermaid code with less to download and faster.

### Pele, a lighter renderer:
Under Settings → Mermaid Blocks, **Renderer** sets what draws the diagrams of the whole site, in the editor and on your pages: **Mermaid.js**, the default, or **Pele**. Nothing in your posts changes, so you can switch back at any time.

Pele draws the same Mermaid code, every diagram type of the Mermaid version the plugin has, and loads much less: a page with a flowchart downloads 149 KB of JavaScript (62 KB compressed) where Mermaid.js takes 884 KB (242 KB compressed), and a diagram is drawn in a few milliseconds. In the editor it is 3 MB less. A page loads one renderer, never both.

Pele draws in a plain look of its own, so a diagram looks different from the same diagram in Mermaid.js:

- **Themes count as light or dark.** The theme settings offer Automatic, Light and Dark. Automatic follows the page, and turns dark with it without drawing the diagram again. A diagram that had another theme keeps it: Dark, Neo Dark, Redux Dark and Redux Dark Color are dark, and every other theme is light. A theme written in the code, in its front matter or in an `%%{init}%%` directive, counts the same way.
- **Colours set in the code are ignored**, such as `themeVariables`.
- **Formulas between `$$` are typeset** with [Temml](https://temml.org/), as MathML that the browser draws in its own math font. Temml is loaded only on a page whose diagrams have a formula. Mermaid.js keeps its own formulas, drawn by KaTeX.
- **`click` with a JavaScript callback is dropped**, as Mermaid.js does at its strict security level. Links (`click A "https://…"`) work.
- **A wide diagram is laid out for the width it has.** On a narrow screen it may turn vertical below 640 pixels, and it is laid out again when its width changes, such as when a phone is turned. A download or a saved image has the full layout, whatever the screen.
- **Zoom is Pele's own.** A diagram with the zoom control can be zoomed with a pinch, a double-click, Ctrl or ⌘ and the wheel, or by dragging, and with `+`, `-`, `0` and the arrow keys once it has focus.
- **Labels are measured again once the site's web font has loaded**, so boxes fit the text in the font the page shows.
- A diagram that Pele can't draw is shown as an error in the editor, and left as code on the page, as a syntax error is. Pele's error message shows the line and a mark under the column.

Downloads, copying, fullscreen, saved images and the accessible title and description work with both renderers, and so does zoom. A download or a saved image of a Pele diagram has the colours of the diagram as you see it.

A developer can choose the renderer for a request, such as Pele only on some pages, with the `mermaid_blocks_renderer` filter. It gets the site's renderer, `mermaid` or `pele`, and returns one of them; anything else means Mermaid.js:

    add_filter( 'mermaid_blocks_renderer', function ( $renderer ) {
        return is_page( 'landing' ) ? 'pele' : $renderer;
    } );

#### Pele's options
A developer can set what Pele may do with the `mermaid_blocks_pele_options` filter. It applies only when the renderer is Pele. People who write diagrams can't set these options: the site decides what a diagram may do, such as showing links and images.

- `links`, `images`: true or false, to allow links and images in diagrams.
- `linkSchemes`, `imageSchemes`: lists of the URL schemes they may use, such as `https`. A list with anything but strings in it is ignored.
- `linkRel`: the `rel` of links.
- `fontSize`, `padding`, `directionBreakpoint`: positive numbers. `directionBreakpoint` is the width in pixels below which a wide diagram may turn vertical.
- `autoDirection`: true or false, to turn that off.
- `limit`, `outputLimit`, `maxEdges`: positive whole numbers, Pele's limits.
- `config`: an array of Mermaid configuration used when a diagram sets none.

A key Pele doesn't know, or a value of the wrong type, is ignored. The plugin sets the font, the measuring, the ids and the responsive layout itself, and they win over the filter:

    add_filter( 'mermaid_blocks_pele_options', function ( $options ) {
        $options['links']    = false;
        $options['fontSize'] = 15;
        return $options;
    } );

#### Styling Pele diagrams with CSS
Pele draws with CSS variables, so a theme can restyle its diagrams. CSS written for Mermaid.js's SVG doesn't apply to Pele's, which has other elements and classes.

- **Colours:** `--pele-bg`, `--pele-fg`, `--pele-muted`, `--pele-line`, `--pele-surface`, `--pele-surface-alt`, `--pele-border`, `--pele-accent`, `--pele-critical`, `--pele-error`, and `--pele-series-1` to `--pele-series-8` for charts.
- **Fonts:** `--pele-font` for labels and `--pele-font-mono` for monospace labels.
- **Weights and corners:** `--pele-title-weight`, `--pele-heading-weight`, `--pele-bold-weight` and `--pele-radius`.
- **Classes:** `.pele` on the SVG, and `.pele-node`, `.pele-edge`, `.pele-edge-label`, `.pele-cluster`, `.pele-cluster-label`, `.pele-label`, `.pele-title`, `.pele-marker`, `.pele-icon` and `.pele-math` on its parts. A node also has a `data-id`, its id in the code, so `[data-id="start"]` picks one node. [Pele's page about theming](https://pele.run/theming) lists them all.

The plugin puts the light or dark palette on the diagram's canvas, `.mermaid-blocks-diagram__canvas`, as inline variables, which beat a rule on the canvas or on an element above it. To change a colour, set the variable on the SVG inside it:

    .mermaid-blocks-diagram__canvas > svg {
        --pele-accent: #c2410c;
        --pele-radius: 8px;
    }

Fonts are different: labels are measured in the font before they are drawn. The plugin reads `--pele-font` and `--pele-font-mono` on the diagram, `.mermaid-blocks-diagram`, or else uses the diagram's own font, and writes the font it measured in into the SVG. So set them on `.mermaid-blocks-diagram`, not on the SVG. A download takes the values the diagram has on the page, so your CSS counts in it too.

### Icons:
A developer can register icon packs with the `mermaid_blocks_icon_packs` filter, for diagrams drawn by either renderer. A pack is the URL of an [Iconify](https://iconify.design/) JSON file, by the name diagrams use before the colon:

    add_filter( 'mermaid_blocks_icon_packs', function ( $packs ) {
        $packs['fa']    = 'https://cdn.jsdelivr.net/npm/@iconify-json/fa6-solid@1.2.4/icons.json';
        $packs['logos'] = 'https://cdn.jsdelivr.net/npm/@iconify-json/logos@1.2.17/icons.json';
        return $packs;
    } );

Then a diagram can use `fa:fa-car` in a label, an icon shape such as `A@{ icon: "fa:user" }`, and `(logos:aws)` in an architecture diagram. A pack's name has lower-case letters, digits and hyphens. A pack is fetched only on a page whose diagrams use one of its icons. Register only packs you trust: their markup goes into the page as it is. People who write diagrams can't add packs.

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

### Libraries:
The diagrams are drawn by [Mermaid](https://mermaid.js.org/), by the Mermaid project (MIT licence), or by [Pele](https://pele.run/), by Obsidian (MIT licence). With Pele, formulas are typeset by [Temml](https://temml.org/), by Ron Kok (MIT licence). For a diagram that asks for the ELK layout, Mermaid uses [ELK](https://eclipse.dev/elk/), by the Eclipse Foundation, as elkjs (Eclipse Public License 2.0, which allows the GPL as a secondary licence). All four are included in the plugin.

### Source code:
The JavaScript in the plugin's `build/` folder is compiled. Its source, with the build scripts, is on GitHub: [land0r/mermaid-blocks](https://github.com/land0r/mermaid-blocks). Run `npm ci && composer install && npm run build` there to build it.

== Installation ==

1. Upload the plugin to the `/wp-content/plugins/mermaid-blocks` directory, or install it through the WordPress plugin screen.
2. Activate the plugin through the 'Plugins' menu.
3. Add the **Mermaid Diagram** block in the block editor.
4. Write Mermaid code and preview your diagram instantly.

== Frequently Asked Questions ==

= What types of diagrams are supported? =
Every type of the Mermaid version the plugin has, Mermaid 12.1: flowcharts, sequence, class, state, entity relationship, user journey, Gantt, pie, quadrant, requirement, C4, Sankey, XY, block, packet, kanban, architecture, radar and treemap diagrams, mind maps, timelines and Git graphs among them. Pele draws them all too.

= Can I edit Mermaid code? =
Yes, you can edit Mermaid code directly in the block editor using plain text.

= Is real-time rendering supported? =
Yes, your diagrams are rendered in real-time as you edit the code.

= Does it work on all themes? =
Yes, it is compatible with most modern WordPress themes.

= How much does a diagram add to a page? =
A page with a diagram gets one script of 8 KB (3.5 KB compressed) and 3.5 KB of styles, and nothing more until a diagram scrolls into view. Then it loads Mermaid, and of Mermaid only what the type of that diagram needs. For a flowchart that is 870 KB of JavaScript, or 240 KB as a server sends it, compressed. Class, state and entity relationship diagrams take as much, sequence diagrams and Gantt charts a little less, and the other types between 190 and 370 KB compressed, except architecture diagrams with 520 KB and use case diagrams with 760 KB. Three quarters of it is the same for every type, so a page with several types loads that part once.

Three things are loaded only for a diagram that uses them: formulas (80 KB compressed), the ELK layout (500 KB) and the controls for visitors (4 KB). A page without a diagram loads nothing from the plugin.

= Should I use Pele? =
If page weight and speed matter more to you than the look of Mermaid.js's themes, yes: choose it under Settings → Mermaid Blocks, look at your diagrams, and switch back if you prefer the old look. Pele draws every diagram type the plugin offers, but in a plainer look of its own, with a light and a dark palette in place of Mermaid's themes. The section "Pele, a lighter renderer" above says what is different.

= Can diagrams show formulas? =
Yes. Write the formula between `$$` in a label. Mermaid.js draws it with KaTeX, Pele with Temml. Either is loaded only on a page whose diagrams have a formula.

= Can diagrams show icons? =
Yes, once a developer has registered icon packs with the `mermaid_blocks_icon_packs` filter. The section "Icons" above shows how. A name that no registered pack has is drawn as before: with Pele, in its own symbol where it has one, such as `database` in an architecture diagram.

= Why does my theme look the same in Pele? =
Pele has no named themes, so with Pele the theme settings offer Automatic, Light and Dark. A diagram that had another theme before keeps it, and shows it as Dark if it is Dark, Neo Dark, Redux Dark or Redux Dark Color, and as Light otherwise; switch back to Mermaid.js and it looks as it did. A theme written in the diagram's code counts the same way.

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
In Elementor, add the Mermaid Diagram widget: it has the block's settings, and its preview shows the diagram as you edit it. Elsewhere, use the `[mermaid]` shortcode: put the Mermaid code between `[mermaid]` and `[/mermaid]`. If a page builder shows the code instead of the diagram, the code has a `<` that WordPress took for the start of a tag: write it as `&lt;`.

= My posts already have Mermaid code in code blocks. Do I have to convert them? =
No. Switch on "Show code marked as Mermaid as diagrams" under Settings → Mermaid Blocks. Code with the `language-mermaid` class is then shown as a diagram, and the posts stay as they are. The diagram replaces the code before the page is sent, so a script of another plugin that draws such code finds none: it is not drawn twice. To keep some code as code, return false from the `mermaid_blocks_show_code_as_diagram` filter.

== Screenshots ==

1. **Adding a diagram block** – Inserting a Mermaid Diagram block in the block editor.
2. **Example: Flowchart** – A rendered flowchart in the block editor.
3. **Example: Sequence Diagram** – A sequence diagram rendered live.
4. **Frontend View** – A Mermaid diagram displayed on the published site.

== Changelog ==

= 2.0.0 =
* Mermaid 12.1, with every diagram type it has.
* A choice of renderer: Mermaid.js, or Pele, which draws the same code with much less JavaScript. With Pele: formulas, layouts for narrow screens, its own zoom, and options a site sets.
* Icons in diagrams, from icon packs a site registers.
* Themes: one for the site and one per diagram, and an automatic theme that follows the page, dark mode included.
* Alignment, spacing, a caption, and an accessible title and description.
* Controls for visitors: zoom, fullscreen, download as SVG or PNG, and copy the code.
* The code field has line numbers, Tab indentation and the line of an error marked. Copy a diagram as PNG from the block's toolbar.
* Saved images of diagrams, for feeds and browsers without JavaScript (off by default).
* The `[mermaid]` shortcode, a Mermaid Diagram widget for Elementor, and code marked as Mermaid in posts shown as diagrams (off by default).
* Abilities for AI agents, with the WordPress Abilities API (WordPress 6.9 and later).
* Lighter pages: Mermaid loads only when a diagram scrolls into view, and only the parts that diagram needs.
* Fix: `&`, `<` and `>` in labels are shown as written.
* Fix: the editor no longer crashes when the Transform menu opens for a block without text.
* Now requires PHP 7.4.

= 1.1.0 =
* Instructions in the editor.
* ObsidianMD markdown to Mermaid Blocks transformation.

= 1.0.0 =
* Initial stable release.
* Add MermaidJS block with support for flowcharts, sequence diagrams, Gantt charts, and class diagrams.
* Real-time rendering of diagrams in the Gutenberg editor.
