# Ollama Smoke — Deferred Integration Test

`scripts/phase3-ollama-smoke.sh` is a real-ollama Phase 3 §4 smoke that
drives `bootRuntime` + `OllamaProvider(gemma3:1b)` against a live daemon
on `localhost:11434` and asserts `channel.in >= 1`, `router.out >= 1`,
and `channel.out >= 1` in the persisted `memory.sqlite`. It exists as a
**separate** smoke from `scripts/phase3-smoke.sh` (which uses an inline
stub provider) because a real ollama call requires ~5–15s of model
inference on CPU and is too fragile for CI on this Pi — earlier
autonomous runs timed out when the 1-min load hit ~13. Run it by hand
after the stub smoke is green, either when the Pi is idle or on a
dedicated host; the script self-gates on `/proc/loadavg` (>6.0 → skip)
and on `/api/tags` reachability. **Exit code 77 means SKIP, not
failure** — it is emitted when ollama is unreachable or the Pi is
overloaded, and should be treated as "not run" rather than a red test.
Exit 0 is a full pass; exit 1 is a real failure (timeout, runtime
crash, or missing event kinds) and must be investigated. Full run log
is written to `/tmp/ollama-smoke-<epoch>.log`.
