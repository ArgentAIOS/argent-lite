# src/config

Runtime configuration for Argent Lite. `mode.ts` defines the
`RuntimeMode` union (`"satellite" | "standalone"`), the `RUNTIME_MODES`
list, the `DEFAULT_RUNTIME_MODE` constant (`"standalone"`), the
`InvalidRuntimeModeError` class, and `loadMode(env?)` which reads
`ARGENT_MODE` from the environment, normalizes it, and returns the
validated mode. Unknown values throw `InvalidRuntimeModeError`; an
unset or empty value resolves to the default. This is the only place
mode parsing lives — every other module imports it from here.
