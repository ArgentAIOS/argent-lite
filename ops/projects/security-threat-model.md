# Security Threat Model — Argent Lite (Pi deploy)

**Status:** draft, cycle-19
**Owner:** architect
**Scope:** Argent Lite running on Raspberry Pi 5 in satellite and
standalone modes. CLI-only, headless, single operator.

## 1. Assets

| Asset | Sensitivity | Where it lives |
| --- | --- | --- |
| Provider credentials (Anthropic, OpenAI, satellite HMAC secret) | high | `~/.config/argent-lite/credentials` (AES-256-GCM, #3) or env |
| `memory.sqlite` — prompts, completions, trace events | high (contains user data + model output) | local disk, unencrypted at rest |
| Runtime config (mode, endpoints, model ids) | medium | `~/.config/argent-lite/config.json` |
| Satellite traffic (Mac ↔ Lite prompts/completions) | high | HTTP over LAN, HMAC-auth (#31) |
| Structured logs + metrics | medium (may echo prompts) | stdout / file sink |
| Source tree + `ops/` | low | git-tracked, public PR stream |

## 2. Trust boundaries

1. **CLI user ↔ Lite process** — local OS user is trusted; anyone with
   shell access to the Pi is trusted.
2. **Lite ↔ local OS / filesystem** — OS is trusted for process
   isolation and file perms. Disk loss = credential + memory loss.
3. **Lite ↔ cloud providers (Anthropic/OpenAI)** — TLS to public APIs,
   provider is semi-trusted (sees prompts and completions).
4. **Lite ↔ Mac satellite** — HTTP over LAN. HMAC-auth establishes
   identity but transport is cleartext.
5. **Lite ↔ ollama / Hailo** — local IPC, trusted.

## 3. STRIDE threats

| # | Category | Threat | Boundary |
| --- | --- | --- | --- |
| S1 | Spoofing | Rogue host on LAN impersonates Mac and submits prompts | 4 |
| S2 | Spoofing | Attacker forges CLI invocation to call cloud providers on operator's bill | 1,3 |
| T1 | Tampering | LAN attacker mutates satellite request body (no integrity if HMAC bypassed) | 4 |
| T2 | Tampering | Attacker with disk access modifies `memory.sqlite` or config | 2 |
| R1 | Repudiation | No signed audit trail — operator can claim a prompt was not sent | 1,2 |
| I1 | Info disclosure | `memory.sqlite` read off disk yields prompts + completions in cleartext | 2 |
| I2 | Info disclosure | Satellite traffic sniffed on LAN reveals prompts + completions | 4 |
| I3 | Info disclosure | Logs leak prompt content or credential fragments to file/stdout | 2 |
| I4 | Info disclosure | Credentials read from `~/.config/...` if file perms drift | 2 |
| D1 | DoS | Satellite endpoint flooded with unauth or bad-HMAC requests | 4 |
| D2 | DoS | Upstream provider outage stalls runtime with no circuit breaker | 3 |
| E1 | Elevation | Prompt injection persuades runtime to leak creds via tool call | 1,3 |
| E2 | Elevation | Runtime constructed outside `bootRuntime` skips auth/memory wiring | 2 |
| E3 | Elevation | Stale rotated credential accepted because no rotation enforcement | 2,3 |

## 4. Mitigations already shipped

- **S1, T1 (partial):** HMAC satellite auth — PR #31
  (`satellite-auth-hardening`). Bearer + HMAC enforced by `requireAuth`.
- **I4, T2 (partial):** AES-256-GCM credential file backend — PR #3
  (`provider-auth`). Keyed from env-derived master key.
- **E2:** `runtime.ts` as sole constructor — PR #41
  (`phase3-runtime-slice`). `bootRuntime()` is the only supported path
  to wire memory + router + channels + auth together.
- **I3 (partial):** Event-kind vocabulary locked to 5 values
  (PR #38) and structured logger (#27) — reduces accidental payload
  logging.

## 5. Gaps (unmitigated)

| Gap | Threat IDs | Notes |
| --- | --- | --- |
| G1 | I1, T2 | No at-rest encryption for `memory.sqlite`. Full prompt+completion history readable from disk. |
| G2 | E3 | No secret rotation enforcement. No TTL, no rotation timestamp, no re-auth on rotate. |
| G3 | I2, T1 | No TLS on satellite HTTP. HMAC covers integrity of the signed body but not confidentiality. |
| G4 | I3 | No log scrubbing. Prompts and completions can reach stdout/file sinks if a future call path logs them. |
| G5 | D1 | No rate-limit / brute-force guard on satellite endpoint. |
| G6 | D2 | No circuit breaker on cloud provider adapters. |
| G7 | R1 | No signed audit log. Memory store is mutable. |
| G8 | E1 | No sandboxing of tool calls (Phase 3 has no tools yet; pre-emptive). |

## 6. Priority-ordered gap fixes for Phase 5

1. **G1 — memory.sqlite at-rest encryption.** Highest impact: disk loss
   or shell access yields full prompt history. Use SQLCipher or app-layer
   AES-GCM page keys; reuse credential master-key derivation.
2. **G4 — log scrubbing.** Cheap, prevents I3 regressions as call paths
   grow. Add a redactor in the logger sink; forbid logging of
   `prompt`/`completion` fields by key.
3. **G3 — TLS on satellite HTTP.** Self-signed cert provisioned at first
   boot, pinned on Mac side. Closes I2 without a CA dependency.
4. **G2 — secret rotation enforcement.** Rotation timestamp in
   credential file; runtime refuses creds older than policy window;
   satellite HMAC secret versioned.
5. **G5 — satellite rate-limit.** Token bucket per source IP; rejects
   bad-HMAC floods before they hit crypto.
6. **G6 — provider circuit breaker.** Fail-fast wrapper around cloud
   adapters; surfaces as a router-level error.
7. **G7 — signed audit log.** Append-only, hash-chained event sink.
   Deferred until Phase 5 tools land (E1 becomes real then).

## 7. Non-goals

- **Multi-tenant isolation.** Argent Lite is single-operator by design.
- **Defending a compromised local OS root.** If root is owned, memory
  encryption and file perms do not help; out of scope.
- **Supply-chain threats to pnpm / node / ollama / Hailo firmware.**
  Tracked separately under Maintainer Gate, not this model.
- **Side-channel attacks on Hailo-10H inference.** Hardware-specific,
  out of scope until hardware lands 2026-04-12 and a real surface exists.
- **Formal proofs of crypto primitives.** Rely on node:crypto and
  documented AES-256-GCM usage.
- **Network attackers outside the LAN.** Satellite mode assumes the LAN
  boundary; WAN exposure is not supported.

## 8. Follow-on slices (proposed, not claimed)

- `memory-at-rest-encryption` — G1
- `log-redactor` — G4
- `satellite-tls` — G3
- `credential-rotation-policy` — G2
- `satellite-rate-limit` — G5
- `provider-circuit-breaker` — G6
- `audit-log-chain` — G7 (Phase 5, after tools land)
