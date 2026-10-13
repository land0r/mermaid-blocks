---
paths:
  - "**/*.php"
---

# PHP

- PHP 7.4 is the minimum: no union types, `match`, nullsafe `?->`, named arguments, constructor promotion or `readonly`. PHPCS flags them.
- Escape output as late as possible, with the function that fits the context: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`. Before changing how `includes/Diagram.php` escapes the diagram source, read the escaping invariant in `AGENTS.md`.
- New code goes in a class in `includes/`, in the `MermaidBlocks` namespace, in a file named exactly after the class, in the folder of its namespace. The root is for what other code may call. A class that adds hooks implements `Hookable` and gets a line in one of the lists of `Plugin`: every request, the admin, or an action to wait for. Never `new` a part: a class names what it needs in its constructor, as parameters typed with a class, and the container creates it.
- Code that runs on the front end must not need a class of `Admin/`, `Abilities/` or `Posts/`: it would load there on every page view. Settings are read through `Options`, not through the settings page.
- An ability is a class in `includes/Abilities/` extending `Ability`, `DiagramAbility` when it works on diagrams, or `PostAbility` when it works on a diagram of one post, with a line in `Registrar::ABILITIES`. Give it an input and an output schema, annotations that say what it changes, and a permission check: for a post, `edit_post`, as `PostAbility` does through `EditablePosts`. Never `__return_true`.
- Writes to post content go through `PostDiagrams`: it checks the hash, saves a revision first, and keeps `innerContent` in step with `innerBlocks`.
- Every change to PHP comes with PHPUnit tests in `tests/` (`npm run test:php`), including the roles that must be refused.
- Prefix hooks, options and the few global functions with `mermaid_blocks_`. Don't rename the public methods of `Diagram`, `Themes` and `Plugin`, nor the methods hooked into WordPress, and don't move a class that is released to another namespace: other code calls them, or removes the hooks through `mermaid_blocks()->get()`.
- Diagram markup is built on every page view that shows a diagram. Keep `Diagram`, `Block::render()` and what they call free of queries and remote requests.
