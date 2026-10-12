---
paths:
  - "**/*.php"
---

# PHP

- PHP 7.4 is the minimum: no union types, `match`, nullsafe `?->`, named arguments, constructor promotion or `readonly`. PHPCS flags them.
- Escape output as late as possible, with the function that fits the context: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`. Before changing how `includes/Diagram.php` escapes the diagram source, read the escaping invariant in `AGENTS.md`.
- New code goes in a class in `includes/`, in the `MermaidBlocks` namespace, in a file named exactly after the class. A new part is created in `Plugin`'s constructor, and `Plugin::init()` calls its `hooks()`.
- An ability is a class in `includes/Abilities/` extending `Ability` (or `DiagramAbility`), passed to `AbilitiesRegistrar` in `Plugin`'s constructor. Give it an input and an output schema, annotations that say what it changes, and a permission check: for a post, `edit_post`, as `DiagramAbility` does. Never `__return_true`.
- Writes to post content go through `PostDiagrams`: it checks the hash, saves a revision first, and keeps `innerContent` in step with `innerBlocks`.
- Every change to PHP comes with PHPUnit tests in `tests/` (`npm run test:php`), including the roles that must be refused.
- Prefix hooks, options and the few global functions with `mermaid_blocks_`. Don't rename the public methods of `Diagram`, `Themes` and `Plugin`, nor the methods hooked into WordPress: other code calls them, or removes the hooks through `mermaid_blocks()`.
- Diagram markup is built on every page view that shows a diagram. Keep `Diagram`, `Block::render()` and what they call free of queries and remote requests.
