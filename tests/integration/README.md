# tests/integration

Integration-only tests that drive real Argent Lite code paths without
hitting the network. Run them with `pnpm test:integration`, which uses
`vitest.integration.config.ts` and includes everything under this folder.

`cli-chat.test.ts` drives the Phase 3 runtime seam (`bootRuntime` from
`src/integration/runtime.ts`) through `stream.PassThrough` stdio with the
stub provider in `stub-provider.ts`. It asserts the reply frame, the
locked event-kind vocabulary (`channel.in`, `router.out`, …), a clean
`runtime.shutdown()` within 500 ms, and no leaked handles. Until the
`bootRuntime` seam lands on the branch the dynamic import fails softly
and the test skips with a clear message — it never fails.
