---
paths:
  - "**/*.php"
---

# PHP

- PHP 7.4 is the minimum: no union types, `match`, nullsafe `?->`, named arguments, constructor promotion or `readonly`. PHPCS flags them.
- Escape output as late as possible, with the function that fits the context: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`. Before changing how `src/render.php` escapes the diagram source, read the escaping invariant in `AGENTS.md`.
- Prefix new global functions, variables and hooks with `mermaid_blocks_`. Don't rename existing hooked functions: code that unhooks them would break.
- `src/render.php` runs on every page view with the block. Keep it free of queries and remote requests.
