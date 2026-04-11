I have read `ops/` and am operating under contract:
`ops/contracts/architect.contract.md`.

## Decision summary

Phase 3 channels ship as three built-ins (`cli-stdio`, `file-watch`,
`http-post`) behind one `Channel` interface. Channels are pure I/O
boundary objects — they publish `ChannelMessage`s onto the existing
`MessageBus` under `channel:<id>:in` and stream replies back from
`channel:<id>:out`. No routing, no agent state, no `MemoryStore` access
inside channels.

## Rationale

- Matches the existing bus-based agent topology (`src/agents/message-bus.ts`,
  `src/agents/agent-context.ts`) — no new primitives, no refactor of
  Phase-2 code.
- Mirrors the `memory-lite-design` §9 shape (`ops/projects/memory-lite-design.md`)
  the team lead asked for: small interface + phased sub-slices + explicit
  acceptance criteria.
- Keeps per-channel auth out of the abstraction: only `http-post` has a
  token knob (`ARGENT_CHANNEL_HTTP_TOKEN`); Slack/satellite channels are
  deferred, consistent with `ops/CLAUDE.md` standing guidance ("scope
  is unresolved, do not design downstream of undecided scope").
- Bounded `AsyncQueue` + 30 s reply timeout enforce the "no unbounded
  buffering" posture required by `ops/rules/never-do.md` (no silent
  backlogs that mask failures).

## Files touched

- `ops/projects/channels-lite-design.md` — new, 130 lines
- `ops/team/outbox/architect.md` — this reply

Both inside the surface authorized by `ops/team/inbox/architect.md`.

## Validation

- Line count: 130 (≤150 requested). `wc -l ops/projects/channels-lite-design.md`.
- `pnpm test` / `pnpm check` / `pnpm build` — not run. Architect role is
  doc-only (`ops/contracts/architect.contract.md` §"What the architect
  does NOT do": "Run builds, tests, or deploys"). No code changed.

## Recommended follow-on slices (names only, no claims)

- `channel-core` — gatekeeper: `src/channels/{index,types,errors,base-channel}.ts`
- `channel-cli-stdio`
- `channel-file-watch`
- `channel-http-post`

`channel-core` blocks the other three; the three channel slices are
independent and parallelizable after core merges.

## Risks / non-goals

- Slack/email/SMS bridges, WebSocket duplex, multi-tenant auth, TLS,
  and satellite-mode channel sync are explicitly out of Phase 3.
- `http-post` localhost-only default is a hard dependency — if an
  engineer relaxes it without a bearer token the channel must refuse to
  bind.
- Mac-station/clean-lane patrol model still does not apply here
  (`ops/CLAUDE.md` "Mac-station mismatch"); no channel work depends on
  it.

## Blockers / open questions

None blocking. Five open questions are enumerated in §10 of
`ops/projects/channels-lite-design.md` — all are engineer-time decisions
inside the named slices, not architect-time blockers.

## Contract traceability

Work traces to `ops/contracts/architect.contract.md` (output shape
§"Output shape") via the parent
`ops/contracts/team-onboarding.contract.md`.
