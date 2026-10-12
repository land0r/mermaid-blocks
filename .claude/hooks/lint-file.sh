#!/bin/sh
# PostToolUse hook: lints the file Claude just edited or wrote.
# Fixes what the linter can fix. Anything left goes to stderr with exit
# code 2, which Claude Code shows to Claude so it fixes it right away.

[ -n "$CLAUDE_PROJECT_DIR" ] && cd "$CLAUDE_PROJECT_DIR" || exit 0

file=$( node -e '
	let input = "";
	process.stdin.on( "data", ( chunk ) => ( input += chunk ) );
	process.stdin.on( "end", () => {
		try {
			process.stdout.write( JSON.parse( input ).tool_input.file_path || "" );
		} catch ( error ) {}
	} );
' )

case "$file" in
	"$CLAUDE_PROJECT_DIR"/*) file=${file#"$CLAUDE_PROJECT_DIR"/} ;;
	/*) exit 0 ;; # Outside the project.
esac

case "$file" in
	build/* | vendor/* | node_modules/*) exit 0 ;;
esac

[ -f "$file" ] || exit 0

export BROWSERSLIST_IGNORE_OLD_DATA=1

case "$file" in
	*.js)
		[ -d node_modules ] || exit 0
		output=$( npx --no-install wp-scripts lint-js --fix "$file" 2>&1 )
		;;
	*.css | *.scss)
		[ -d node_modules ] || exit 0
		output=$( npx --no-install wp-scripts lint-style --fix "$file" 2>&1 )
		;;
	*.php)
		[ -x vendor/bin/phpcs ] || exit 0
		vendor/bin/phpcbf -q "$file" > /dev/null 2>&1
		output=$( vendor/bin/phpcs -q "$file" 2>&1 )
		;;
	*)
		exit 0
		;;
esac

[ $? -eq 0 ] && exit 0

printf 'Lint errors remain in %s:\n%s\n' "$file" "$output" | head -n 80 >&2
exit 2
