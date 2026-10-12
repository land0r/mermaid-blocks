@AGENTS.md

## Claude Code

- Hooks in `.claude/settings.json` lint each file right after you edit it and run the unit tests before you finish when `src/` changed. Fix what they report; don't work around them.
- Rules in `.claude/rules/` load when you work on PHP files or on the block's markup.
- Editing `build/` is denied. Run `npm run build` instead.
