# src/cli

Headless CLI entrypoint for Argent Lite Phase 1. `index.ts` exports a
single async `main(argv?)` that parses argv into a prompt, calls
`loadMode()` from `src/config/mode.ts`, dynamically imports the router
from `src/router` (guarded so this slice builds standalone), forwards
the prompt, prints the response to stdout, and returns a numeric exit
code (`0` success, `2` usage error, `3` router unavailable). The module
is import-safe: it only runs `main()` when invoked directly as a script.
