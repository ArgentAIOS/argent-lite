// LOCKED VOCABULARY — these are the ONLY 5 kinds the Phase 3 runtime writes
// to memory.sqlite. Any new kind requires a design change: update
// ops/projects/event-kind-vocabulary.md first, then this file, retention
// indexes, and metrics labels together. Do not add kinds ad-hoc.
export const EVENT_KINDS = Object.freeze([
  "channel.in",
  "channel.out",
  "router.in",
  "router.out",
  "agent.error",
] as const);

export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(v: string): v is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(v);
}

export function assertEventKind(v: string): asserts v is EventKind {
  if (!isEventKind(v)) throw new Error(`invalid event kind: ${v}`);
}
