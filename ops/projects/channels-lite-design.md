# Channels Lite Design — Phase 3 Gate Planning Doc

**Status:** planning-complete · **Slice:** `channels-lite-design` ·
**Branch:** `codex/channels-lite-design` · **Owner:** architect ·
**Parent:** `ops/projects/agent-topology-lite.md` ·
**Consumers:** engineer slices `channel-core`, `channel-cli-stdio`,
`channel-file-watch`, `channel-http-post`, then downstream
`intent-routing-lite`.

## 1. Decision summary

A **channel** is the boundary object that moves a request from the outside world into an agent and streams the agent's reply back out. Phase 3 ships **three** channels — `cli-stdio`, `file-watch`, `http-post` — behind one `Channel` interface. Channels do not pick agents; they emit `ChannelMessage`s onto the existing `MessageBus` and the router (separate slice) decides routing. Slack/email/satellite channels are out of scope for Phase 3.

## 2. Scope and non-goals

**In scope:** interface contract, three built-in channels, lifecycle, backpressure, slice breakdown, open questions.
**Non-goals:** Slack/email/SMS bridges, WebSocket duplex, multi-tenant auth, channel-level rate limiting, satellite-mode channel sync, transport encryption (HTTP channel is plaintext localhost only).

## 3. Channel model

A channel has three responsibilities and nothing else:

1. **Ingress** — turn an external event (stdin line, file append, HTTP POST body) into a `ChannelMessage { id, channelId, body, meta }`.
2. **Delivery** — publish the message onto `ctx.bus` under a channel-owned topic (`channel:<id>:in`).
3. **Egress** — subscribe to replies on `channel:<id>:out` and stream them back to the originating caller (stdout, reply file, HTTP response).

Channels are **stateless across requests** except for an in-memory `pending` map that correlates `messageId → reply sink`. No channel touches agent state or `MemoryStore` directly.

## 4. Channel ↔ agent contract

```ts
interface ChannelMessage<T = unknown> {
  id: string;            // uuid, also the reply correlation key
  channelId: string;     // "cli-stdio", "file-watch", "http-post:8787"
  body: T;               // parsed payload (string for cli/file, JSON for http)
  meta: Record<string, string>;  // e.g. { "http.path": "/chat", "file.path": "..." }
  receivedAt: number;    // epoch ms
}

interface ChannelReply<T = unknown> {
  messageId: string;     // echoes ChannelMessage.id
  body: T;
  final: boolean;        // false = streaming chunk, true = last frame
}

interface Channel {
  readonly id: string;
  start(ctx: AgentContext): Promise<void>;
  stop(): Promise<void>;
}
```

An agent consumes `channel:*:in` and emits `channel:<id>:out` frames with matching `messageId`. Streaming is N non-final frames followed by one `final:true`. Channels MUST enforce a per-message timeout (default 30 s) and emit a synthetic `final:true` error frame on timeout so the caller never hangs.

## 5. Phase-3 built-in channels

| Channel | Ingress | Egress | Use case |
| --- | --- | --- | --- |
| `cli-stdio` | readline on `process.stdin` | write to `process.stdout` | interactive local REPL, `argent chat` |
| `file-watch` | `fs.watch` on a drop-dir; each new file = one message | write sibling `<name>.reply.json` | batch jobs, scripted pipelines |
| `http-post` | `node:http` server, `POST /chat` with JSON body | JSON response on same request (or SSE if `Accept: text/event-stream`) | LAN clients, simple integrations |

All three bind **localhost-only** by default. `http-post` takes an optional bearer token from `ARGENT_CHANNEL_HTTP_TOKEN`; absence means the server refuses to bind to non-loopback addresses.

## 6. Lifecycle and backpressure

- `start(ctx)` is called once by the scheduler during boot; `stop()` on SIGTERM. Channels are additive — adding one never restarts others.
- Each channel owns a bounded `AsyncQueue` (default 64) between ingress and bus publish. Full queue → `cli-stdio` blocks stdin read, `file-watch` defers the `fs.watch` callback, `http-post` replies `503 channel-busy`.
- Reply sinks time out at 30 s per `messageId`; stale entries are GC'd so a crashed agent cannot leak memory.

## 7. Candidate file areas

```
src/channels/
  index.ts          # re-exports Channel, ChannelMessage, ChannelReply, errors
  types.ts          # shared shapes
  errors.ts         # ChannelTimeoutError, ChannelBusyError, ChannelAuthError
  base-channel.ts   # shared pending-map + timeout + bus plumbing
  cli-stdio.ts      # CliStdioChannel
  file-watch.ts     # FileWatchChannel
  http-post.ts      # HttpPostChannel
test/channels/{cli-stdio,file-watch,http-post,base}.test.ts
```

No writes outside `src/channels/**` except demo-runner wiring and a
one-line `AgentContext` note (handled in its own slice).

## 8. Phased slice breakdown

| Slice | Surface | Depends on |
| --- | --- | --- |
| `channel-core` | `src/channels/{index,types,errors,base-channel}.ts` + base tests | this doc |
| `channel-cli-stdio` | `src/channels/cli-stdio.ts` + tests | `channel-core` |
| `channel-file-watch` | `src/channels/file-watch.ts` + tests | `channel-core` |
| `channel-http-post` | `src/channels/http-post.ts` + tests | `channel-core` |

`channel-core` is the gatekeeper. The three channel slices are
independent and may run in parallel once core merges.

## 9. Acceptance criteria (engineer-facing)

1. `cli-stdio`: line in → `channel:cli-stdio:in` published; reply frame
   with matching `messageId` prints to stdout; `final:false` chunks
   print without newline, `final:true` ends the line.
2. `file-watch`: dropping `req.json` produces one message; agent reply
   lands at `req.reply.json`; duplicate filename rejected with error
   reply file.
3. `http-post`: `POST /chat` with JSON returns matching reply; missing
   bearer token when configured → `401`; queue full → `503`.
4. Per-message 30 s timeout emits synthetic error frame on every channel.
5. `stop()` drains pending replies (or times them out) and releases
   stdin/file-watcher/HTTP-server handles; test asserts no dangling
   handles via `process._getActiveHandles().length`.

## 10. Open questions

1. **Auth per channel:** only `http-post` has a token knob in Phase 3.
   Slack/satellite channels will need per-channel auth adapters; defer
   the abstraction until a second authenticated channel exists.
2. **Multi-tenant:** Phase 3 is single-operator. `ChannelMessage.meta`
   carries no `tenantId` yet; router slice owns the call on whether to
   add one before Slack lands.
3. **Streaming transport for `http-post`:** SSE is cheapest; WebSocket
   is deferred unless a consumer needs bidirectional frames.
4. **File-watch semantics on rename vs create:** stick with create-only
   (`fs.watch` `rename` event where `existsSync` is true); document
   editor-save quirks in the slice README.
5. **Satellite bridge:** a future `channel-satellite` wraps the
   satellite protocol as another `Channel` — out of scope here but the
   interface is deliberately small enough to accept it.
