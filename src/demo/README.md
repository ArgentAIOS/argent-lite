# demo

The demo runner wires the Phase-2 skeletons together end-to-end. It boots a `MessageBus`, an `AgentContext`, and a `Scheduler`, dynamically imports `HelloAgent` from `src/agents/hello-agent.ts` (delivered by the `codex/agent-helloagent` slice), registers it, enqueues a single `greet` task, ticks the scheduler once, and prints the agent's echoed greeting. If `HelloAgent` is not present on the current branch the runner logs `[demo] HelloAgent not available on this branch` and exits cleanly so this slice can build standalone. Run it with `pnpm demo`.
