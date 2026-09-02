---
name: bkalendar-next
description: Preserve BKalendar Next architecture, privacy, calendar-sync safety, and verification requirements when implementing or reviewing this repository.
---

# BKalendar Next

Use this skill for work inside the BKalendar Next monorepo.

## Establish current state

- Read `./CODEX_HANDOFF.md` before substantial implementation.
- Treat the current source tree and freshly run tests as newer evidence than the handoff when they differ.
- Keep `../bkalendar-core` and `../bkalendar.github.io` read-only.
- Do not initialize Git, publish, deploy, or push unless the user explicitly asks.

## Architecture and privacy

- Keep the MVP local-first with no Firebase or application backend.
- Keep shared domain logic framework-independent in `packages/*`.
- Do not persist or transmit MyBK passwords, session cookies, Google access tokens, or refresh tokens.
- Do not migrate the selected Svelte/Vite direction to React or another framework without an explicit decision.
- The active current-student parser is under `packages/core/src/parser/*`; do not use the duplicate legacy files at `packages/core/src/{errors,model,student-2024,utils}.ts`.

## Calendar safety invariants

- Require explicit user confirmation before Google Calendar writes.
- Never permit deletions when capture completeness is `incomplete` or `unknown`; propagate `TimetableDiff.canDelete` to reconciliation as `allowDeletes`.
- Only patch or delete Google events carrying BKalendar private metadata, including `managedBy=bkalendar-next`.
- Stable event identity must exclude mutable values such as time, room, weeks, metadata, and color.
- A second sync of an identical snapshot must perform zero writes.
- Create one dedicated managed calendar, persist its returned ID, and reuse that ID. Never silently create a replacement after lookup or authorization failure.
- Persist an accepted snapshot only after successful sync or explicit resolution of partial failures.
- Apple Calendar MVP support is a one-time `.ics` export/import, not automatic sync.

## Implementation discipline

- Follow test-driven development for behavior changes: verify RED, implement minimally, then run focused and full regression tests.
- Preserve all existing tests. Before claiming completion, run the applicable test, typecheck, build, and browser validation steps.
- Report any package-registry, certificate, OAuth, browser, or build blocker explicitly; do not imply unrun checks passed.
- Favor narrow changes that complete the next verified product slice over speculative infrastructure or unrelated refactors.
