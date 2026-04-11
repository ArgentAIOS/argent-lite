# src/integration

This folder is reserved for integration glue code that wires Phase 1
components (router, providers, auth, CLI) into higher-level orchestration
paths. End-to-end tests that spawn the real CLI binary live under
`tests/integration/` and are gated behind `pnpm test:integration` so they
stay out of the default `pnpm test` unit run. Tests that require a live
local model will skip when `ollama` is not reachable at
`http://localhost:11434`.
