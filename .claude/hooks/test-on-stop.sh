#!/bin/sh
# Stop hook: runs the unit tests before Claude finishes when src/ has
# uncommitted changes. Failures go to stderr with exit code 2, which sends
# Claude back to fix them. It does so once: when Claude is already
# continuing because of this hook, stop_hook_active is true and it lets
# Claude stop, so the two can't loop.

[ -n "$CLAUDE_PROJECT_DIR" ] && cd "$CLAUDE_PROJECT_DIR" || exit 0

active=$( node -e '
	let input = "";
	process.stdin.on( "data", ( chunk ) => ( input += chunk ) );
	process.stdin.on( "end", () => {
		try {
			process.stdout.write( JSON.parse( input ).stop_hook_active ? "1" : "" );
		} catch ( error ) {}
	} );
' )

[ -z "$active" ] || exit 0
[ -d node_modules ] || exit 0
[ -n "$( git status --porcelain -- src )" ] || exit 0

output=$( npm run test:unit --silent 2>&1 ) && exit 0

{
	echo 'Unit tests fail:'
	printf '%s\n' "$output" | tail -n 80
} >&2
exit 2
