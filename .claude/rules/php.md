---
paths:
  - "**/*.php"
---

# PHP

- PHP 7.4 is the minimum: no union types, `match`, nullsafe `?->`, named arguments, constructor promotion or `readonly`. PHPCS flags them.
- Escape output as late as possible, with the function that fits the context: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`. Before changing how `includes/diagram.php` escapes the diagram source, read the escaping invariant in `AGENTS.md`.
- Prefix new global functions, variables and hooks with `mermaid_blocks_`. Don't rename existing hooked functions or the public functions in `includes/diagram.php`: other code calls or unhooks them.
- Diagram markup is built on every page view that shows a diagram. Keep `includes/diagram.php` and `src/render.php` free of queries and remote requests.
