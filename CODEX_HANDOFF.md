# BKalendar Next — Codex Handoff

> **Purpose:** This is the single source of truth for continuing the unfinished BKalendar Next implementation. Read this entire document before editing code.
>
> **Workspace root:** `.`
>
> **Status at handoff:** domain foundation is implemented and verified; browser UI and full MV3 extension are not implemented yet.
>
> **Handoff date:** 2026-09-02.

---

## 0. Continuation status — 2026-09-03

The original handoff state below is preserved for history. The current source
tree and this section supersede older statements that the web workflow,
SvelteKit shell, extension shell, legacy parsers, lockfile, or CI do not exist.

Implemented after handoff:

- dependency installation and `pnpm-lock.yaml`;
- Node-test-based root/package test scripts and strict TypeScript fixes;
- static SvelteKit web app with paste/import, weekly review, diff summary,
  local pending-profile persistence, `.ics` download, Google GIS loader, and
  tested Google sync/profile-promotion orchestration;
- Google OAuth configuration template in `.env.example`; no real client ID or
  secret is committed;
- Chrome/Edge MV3 shell with narrow MyBK permission, DOM observation,
  normalized pending snapshots in `chrome.storage.local`, privacy-minimized
  status/change counts, badge, popup, and build artifacts;
- current student, legacy student, lecturer, and postgraduate parsers;
- public source auto-detection/dispatcher;
- GitHub Actions CI and GitHub Pages workflows;
- MIT license, upstream attribution, and README;
- removal of the obsolete duplicate core implementation files.

Latest verified commands:

```text
pnpm exec prettier --check .                 pass
pnpm test                                    101 pass, 0 fail
pnpm check                                   pass
pnpm build                                   pass
BASE_PATH=/bkalendar-next pnpm --filter @bkalendar-next/web build
                                              pass
pnpm peers check                             no issues
```

Browser QA verified localhost page identity, meaningful render, sample import,
desktop/mobile layouts, diff rendering, and the missing-OAuth configuration
message with no app console errors. The in-app browser did not expose a
download event for the Blob-based `.ics` action; download construction,
temporary-link attachment, cleanup, and RFC 5545 content are covered by tests.

Still not complete:

- real Google OAuth/API matrix testing requires a user-created Google Cloud
  browser client ID and authorized origins;
- extension must be manually loaded and tested on the real authenticated MyBK
  timetable page in Chrome and Edge;
- real calendar imports still need manual Google/Apple integration testing;
- no production deployment or extension-store release has occurred.

---

## 1. Product brief

Build a modern successor to <https://github.com/bkalendar/bkalendar.github.io> that preserves its strong HCMUT timetable parsing while fixing its product and integration problems.

The user wants:

1. A substantially better, modern, responsive Vietnamese UI.
2. Google Calendar sync that **updates the previously managed calendar/events** instead of creating parallel duplicate calendars/events on every import.
3. Change tracking for MyBK timetables.
4. Google account chooser supporting ordinary Gmail and HCMUT Google Workspace accounts; do not bias/restrict to `@hcmut.edu.vn`.
5. Apple Calendar support where feasible.
6. Source hosted on GitHub and the website deployed to GitHub Pages.
7. Chrome + Edge extension that detects timetable changes locally.
8. No Firebase/backend for v1. The final decision is local-first only.

### Final decisions made with the user

- New GitHub monorepo rather than modifying/forking upstream directly.
- GitHub Pages for the website.
- Chrome + Edge Manifest V3 extension.
- Extension detects changes and shows a diff; **Google writes happen only after explicit confirmation**.
- Apple v1 support is standards-compliant `.ics` download/open/import, not webcal/CalDAV.
- No Firebase/backend in v1.
- Local storage only; do not store MyBK credentials, cookies, Google access tokens, or raw timetable on a server.
- Extension can detect reliably when the timetable page is opened/refreshed. It may later attempt periodic checks while Chrome and the MyBK session are active, but cannot track when the machine/browser is off or the session expired.

### Explicit non-goals for v1

- No unattended 24/7 cloud polling.
- No MyBK password/session-cookie storage.
- No Apple CalDAV or iCloud password collection.
- No webcal subscription without a future backend.
- No silent Google event deletion.
- No destructive migration of legacy calendars based only on calendar names.

---

## 2. Reference repositories and exact revisions

Two read-only clones are available next to this project:

1. Original frontend:
   - Path: `../bkalendar.github.io`
   - Commit: `2d76646e85d60723614b9b06a96529ec0c009f8c`
   - Upstream: <https://github.com/bkalendar/bkalendar.github.io>

2. Original core:
   - Path: `../bkalendar-core`
   - Commit: `0e1522d000f2fca11bce3f46bec0299929f3fea7`
   - Version: `@bkalendar/core` 24.1.0
   - Upstream: <https://github.com/bkalendar/core>

Do not edit the reference clones. New work belongs in `bkalendar-next`.

The upstream code is MIT licensed. Preserve attribution and include upstream license notices when porting more parser code.

---

## 3. Intended monorepo

```text
bkalendar-next/
├── apps/
│   ├── web/                    # GitHub Pages web app
│   └── extension/              # Chrome/Edge MV3 extension
├── packages/
│   ├── core/                   # timetable model/parser/resolver/snapshot conversion
│   ├── timetable/              # stable identity, fingerprints, diff, profile storage
│   ├── google-calendar/        # OAuth, REST gateway, reconciliation
│   └── ical/                   # RFC 5545 formatter
├── fixtures/                   # sanitized source/DOM fixtures (not populated yet)
├── .github/workflows/          # not implemented yet
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── CODEX_HANDOFF.md
```

`packages/*` should stay framework-independent TypeScript. Web and extension should consume the same domain contracts.

---

## 4. Current file inventory

At handoff, the project contains these relevant source/test files:

```text
apps/extension/src/content/extract.ts
apps/extension/test/extract.test.ts
apps/extension/package.json
apps/extension/tsconfig.json

apps/web/test/workflow.test.ts

packages/core/src/index.ts
packages/core/src/timetable.ts
packages/core/src/resolver.ts
packages/core/src/snapshot.ts
packages/core/src/parser/errors.ts
packages/core/src/parser/student-2024.ts
packages/core/src/parser/utils.ts
packages/core/test/core.test.ts

packages/timetable/src/index.ts
packages/timetable/src/storage.ts
packages/timetable/test/diff.test.ts
packages/timetable/test/storage.test.ts

packages/google-calendar/src/index.ts
packages/google-calendar/src/oauth.ts
packages/google-calendar/src/rest.ts
packages/google-calendar/test/oauth.test.ts
packages/google-calendar/test/reconcile.test.ts
packages/google-calendar/test/rest-gateway.test.ts

packages/ical/src/index.ts
packages/ical/test/format.test.ts
```

### Duplicate/unreferenced core files to inspect and remove safely

Concurrent implementation created an earlier duplicate set:

```text
packages/core/src/errors.ts
packages/core/src/model.ts
packages/core/src/student-2024.ts
packages/core/src/utils.ts
```

The active barrel `packages/core/src/index.ts` exports from `timetable.ts`, `parser/*`, `resolver.ts`, and `snapshot.ts`, not from these duplicate files. Before deleting them, run a repository-wide import search to confirm no consumer references them. They were created during this task and are safe to remove if unreferenced.

Do not delete the active `packages/core/src/parser/*` files.

---

## 5. Implemented behavior

### 5.1 Current MyBK parser

Active source:

- `packages/core/src/parser/student-2024.ts`
- `packages/core/src/parser/utils.ts`
- `packages/core/src/parser/errors.ts`

Behavior:

- Parses current MyBK 2024+ tab-delimited table.
- Handles Vietnamese Unicode normalization.
- Parses semester like `20261 - Học kỳ 1 Năm học 2026 - 2027` into numeric `261`.
- Parses `Ngày cập nhật gần nhất của HK này: DD/MM/YYYY HH:mm:ss` into ISO with `+07:00`.
- Supports weekdays `2..7` and `CN` as `8`.
- Skips rows whose time is `--`.
- Validates column count, time ranges, week numbers `1..53`, and academic-year continuity.
- Emits structured extras: `courseCode`, `group`, `credits`, `tuitionCredits`, `campus`.

Only the current student parser is ported. Legacy student, lecturer, and postgraduate parsers still need to be ported from the reference core and tested.

### 5.2 Immutable UTC-safe resolver

Active source: `packages/core/src/resolver.ts`.

Behavior:

- Validates semester YYT encoding and term `1|2|3`.
- Uses UTC weekday arithmetic (`getUTCDay`) rather than local timezone.
- Returns a new resolved timetable instead of mutating the input.
- Rejects all-null/unresolvable schedules with a domain error.
- Detects mixed semester start candidates transactionally without leaving partial mutation.

### 5.3 Snapshot conversion

Active source: `packages/core/src/snapshot.ts`.

Behavior:

- Converts `ResolvedTimetable` to `TimetableSnapshot`/`ManagedEvent`.
- Computes real UTC event start/end based on Vietnam UTC+7 wall-clock values.
- Rebases active week indexes relative to the first actual occurrence.
- Emits excluded starts.
- Carries source kind, semester, course/group metadata, warnings, completeness, capture timestamp.
- Calls the timetable package to assign stable keys and event/snapshot fingerprints.

### 5.4 Stable identity and diff

Active source: `packages/timetable/src/index.ts`.

Important contracts:

- `SourceKind`
- `ManagedEvent`
- `TimetableSnapshot`
- `CaptureCompleteness`
- `createStableEventKey`
- `createEventFingerprint`
- `createSnapshot`
- `diffSnapshots`

Stable identity includes:

- source kind;
- semester;
- normalized course code (or title fallback);
- normalized group;
- session ordinal;
- weekday.

Stable identity deliberately excludes mutable fields such as time, room, weeks, metadata, and color. Therefore a room/time change is classified as `changed`, not remove+add.

Event fingerprints include the full canonical event payload excluding the previous fingerprint. Object keys are canonicalized recursively.

Diff results contain:

- added;
- changed with changed field names;
- removed;
- unchanged;
- `canDelete`, false when capture completeness is not confirmed.

Duplicate stable keys are rejected rather than guessed.

Potential future improvement: current `sessionOrdinal` is assigned by parser row encounter order within an anchor. Reordering multiple meetings of the same course/group/weekday could move IDs. Add deterministic/collision-aware row matching before declaring production readiness.

### 5.5 Local profile storage

Active source: `packages/timetable/src/storage.ts`.

Behavior:

- Storage abstraction `KeyValueStorage` works with browser localStorage or extension adapters.
- Versioned `SyncProfile` stores source/semester, calendar name/ID, accepted/pending snapshots, last check/sync timestamps.
- Does not persist Google access or refresh tokens.
- Rejects unsupported/corrupt schema versions.
- Includes `createBrowserStorage` for `localStorage`.

Need to add a Chrome storage adapter in the extension (`chrome.storage.local`).

### 5.6 Google OAuth

Active source: `packages/google-calendar/src/oauth.ts`.

Behavior:

- Uses Google Identity Services token client.
- Scope currently selected: `https://www.googleapis.com/auth/calendar.app.created`.
- No `hosted_domain`; ordinary Gmail and HCMUT Workspace use the same account chooser.
- Prompts account selection/consent.
- Rejects OAuth errors and missing access tokens.
- Returns the short-lived access token in memory.
- Supports token revocation.

Do not store tokens in local or extension storage.

Before real deployment, verify `calendar.app.created` supports all chosen calendar/event operations for the OAuth project. If Google rejects a required operation, broaden scope only as needed and explain it in UI/privacy docs.

### 5.7 Google REST adapter

Active source: `packages/google-calendar/src/rest.ts`.

Behavior:

- Calls Calendar v3 using Bearer token and `fetch`; does not use `gapi.client`.
- Creates one dedicated managed calendar with Asia/Ho_Chi_Minh timezone.
- Converts managed events to Google event resources.
- Adds private extended properties:
  - `managedBy=bkalendar-next`
  - `schemaVersion=1`
  - `stableKey`
  - `fingerprint`
- Lists all managed recurring masters with pagination and `singleEvents=false`.
- Ignores malformed/manual events without app metadata.
- Insert, patch, and delete operations.
- Forwards ETags as `If-Match` on patch/delete.
- Emits recurrence and EXDATE values.
- Returns typed API errors.

### 5.8 Google reconciliation

Active source: `packages/google-calendar/src/index.ts`.

Behavior:

- Matches local/remote managed events by stable key.
- Identical fingerprints produce no write.
- New local event → insert.
- Existing changed event → patch.
- Missing local event → delete, unless `allowDeletes === false`.
- Deterministic operation order: inserts, patches/no-ops, deletes.
- Continues after per-item failure and reports failures.
- Rejects duplicate keys.
- Supports progress callback.

The key anti-duplicate invariant is covered: a second sync of the same snapshot makes zero writes.

Need to connect `TimetableDiff.canDelete` to `syncManagedCalendar(..., { allowDeletes: diff.canDelete })` in the UI/workflow. Never delete if capture is incomplete/unknown.

### 5.9 RFC 5545 iCalendar

Active source: `packages/ical/src/index.ts`.

Behavior:

- Deterministic UID derived from stable key.
- RFC 5545 text escaping for backslash, newline, semicolon, comma.
- UTF-8-safe 75-octet line folding with continuation whitespace.
- CRLF and final CRLF.
- VTIMEZONE for Asia/Ho_Chi_Minh.
- Weekly RRULE and EXDATE.
- Calendar name metadata.
- Machine-timezone-independent formatting.

Need to add browser download/share helpers:

- Blob MIME `text/calendar;charset=utf-8`.
- Sanitized `${name}.ics` filename.
- `navigator.share({ files })` progressive enhancement on supported mobile browsers.
- Normal download fallback.
- Copy explaining that Apple import is one-time, not automatic sync.

### 5.10 MyBK DOM extractor

Active source: `apps/extension/src/content/extract.ts`.

Behavior:

- Finds a table whose normalized headers match the current MyBK timetable.
- Reorders/maps cells into the tab-delimited shape understood by core.
- Parses source update timestamp.
- Detects footer count such as `Trình bày từ dòng 1 đến 10 / 11 dòng`.
- Marks capture `complete`, `incomplete`, or `unknown`.
- Throws if timetable table is absent rather than interpreting an empty page as all events removed.

Need additional sanitized DOM fixtures for:

- all rows displayed;
- pagination/page-size variations;
- DataTables delayed rendering;
- logged-out/session-expired page;
- header reordering;
- no-class/`--` rows;
- Sunday;
- previous/current semesters.

---

## 6. Verification evidence at handoff

### Green suites

Command used (does not depend on package installation):

```bash
env -i PATH="/usr/local/bin:/usr/bin:/bin" HOME="$HOME" /usr/local/bin/node --experimental-strip-types --test "./packages/core/test/core.test.ts" "./packages/timetable/test/diff.test.ts" "./packages/timetable/test/storage.test.ts" "./packages/google-calendar/test/oauth.test.ts" "./packages/google-calendar/test/rest-gateway.test.ts" "./packages/google-calendar/test/reconcile.test.ts" "./packages/ical/test/format.test.ts" "./apps/extension/test/extract.test.ts"
```

Latest result:

```text
tests 28
suites 12
pass 28
fail 0
```

Coverage includes parser, snapshot conversion, resolver, stable identity, diff, profile storage, OAuth account handling, REST payload/gateway, reconciliation, ICS, and DOM extraction.

### Intentional RED suite—continue TDD here

`apps/web/test/workflow.test.ts` was written immediately before the user requested handoff.

It imports a not-yet-created module:

```text
apps/web/src/lib/workflow.ts
```

Expected current failure:

```text
ERR_MODULE_NOT_FOUND: apps/web/src/lib/workflow.ts
```

This is an intentional RED test, not a regression. Implement the smallest `prepareTimetable` function to make it green:

1. `parseStudent2024(raw)`
2. `resolveTimetable(parsed)`
3. `toTimetableSnapshot(resolved, options)`
4. `diffSnapshots(previousSnapshot, newSnapshot)`
5. return `{ profileId: `student-2024:${semester}`, snapshot, diff }`

Then run:

```bash
env -i PATH="/usr/local/bin:/usr/bin:/bin" HOME="$HOME" /usr/local/bin/node --experimental-strip-types --test "./apps/web/test/workflow.test.ts"
```

The third workflow test removes the sole data row and passes incomplete capture metadata. Ensure it returns one potential removal with `canDelete=false`.

---

## 7. Toolchain/environment blocker

Package installation was attempted but blocked by this session's network/certificate environment:

- Corepack/pnpm emitted repeated `failed to copy trust settings of system certificate-25291`.
- npm registry access returned `403` for `@types/chrome`.
- The original frontend's JSR dependency also returned `403` earlier.

Consequences:

- `pnpm-lock.yaml` for the new monorepo has not been generated.
- Full TypeScript checks, Vite builds, and browser previews have not yet been run.
- Node 24's native test runner with `--experimental-strip-types` was used successfully for dependency-free tests.

Do not hide this limitation. Retry package installation in Codex's environment. If network works:

```bash
cd "."
pnpm install
pnpm test
pnpm check
```

The root package currently pins `pnpm@11.25.0` because that was the locally available Corepack version. Prefer pinning a known-supported pnpm version after a successful install, not `latest`.

### Vite/Svelte decision at interruption

The original plan called for a modern SvelteKit app. Registry failure prevented installing Svelte/SvelteKit. A possible fallback considered was Vite + framework-free TypeScript so the app could be previewed with cached Vite, but **no web implementation or framework switch was committed**. Decide after testing package access:

- Preferred: modern SvelteKit static app if dependencies install.
- Acceptable fallback: Vite + TypeScript DOM app, keeping all domain packages unchanged.

Do not add a second framework casually. Pick one shell and document the choice.

---

## 8. UX/design direction

Audience: HCMUT students/lecturers. The main job is to turn a hard-to-read MyBK timetable into a calendar that stays correct.

### Signature component

Build a **schedule diff board** that resembles the actual timetable and highlights changes directly:

- green + icon/text = added;
- amber + icon/text = changed;
- red dashed/hatch + icon/text = removed;
- neutral = unchanged.

Do not rely on color alone. Include an equivalent text list.

### Visual system

Suggested tokens:

- Ink: `#102A43`
- BK blue: `#0067A3`
- Cyan: `#14B8A6`
- Paper: `#F7FAFC`
- Amber: `#D97706`
- Red: `#C2414B`

Typography:

- Be Vietnam Pro for display/body.
- IBM Plex Mono for course codes, week numbers, and status data.

Avoid generic SaaS dashboard/glassmorphism. Use timetable-grid lines as the structural motif.

### Main web flow

1. **Import**
   - Paste manually or explain/install extension.
   - Auto-detect current MyBK parser; advanced source selector later.
   - Parse errors with actionable guidance.

2. **Review**
   - Semester, last source update, course/session count, warnings.
   - Weekly timetable preview using Asia/Ho_Chi_Minh—not local machine timezone.

3. **Changes**
   - Added/changed/removed/unchanged summary and field-level details.
   - If incomplete capture, removals shown as unverified and delete disabled.

4. **Destination**
   - Google Calendar managed sync.
   - Apple Calendar / other apps `.ics` export.

5. **Result**
   - Item progress and partial failure details.
   - Retry button.
   - Persist accepted snapshot only after successful/explicitly resolved sync.

Accessibility requirements:

- `<html lang="vi">`
- semantic `<main>`;
- labels for textarea/name/semester;
- fieldset/legend for choices;
- keyboard-visible focus;
- `aria-live` for parse/sync errors and progress;
- WCAG AA contrast;
- prefers-reduced-motion;
- mobile layout with sticky primary action;
- screen-reader-readable text alternative to the visual grid.

---

## 9. Extension architecture to implement

Target: Chrome + Edge Manifest V3.

### Required pieces

```text
apps/extension/
├── manifest.json
├── src/content/extract.ts       # already implemented
├── src/content/index.ts         # observe/capture MyBK page
├── src/background/index.ts      # state, badge, optional alarms
├── src/popup/index.html
├── src/popup/main.ts
├── src/options/...              # settings/data controls
└── assets/icons/...
```

### Permissions

Request the minimum possible:

- `storage`
- `notifications` only if used
- `alarms` only after periodic endpoint feasibility is verified
- narrow host permissions for the actual MyBK timetable URL, e.g. `https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb*`

Do not request `<all_urls>`.

### Content flow

1. Verify exact timetable page URL.
2. Wait for table after SPA/DataTables rendering.
3. Use debounced `MutationObserver`.
4. Call `extractMyBkTableFromDocument(document)`.
5. Parse/resolve/snapshot via shared core.
6. Compare with accepted snapshot in `chrome.storage.local`.
7. If changed, save `pendingSnapshot`, set action badge, optionally show notification.
8. If capture incomplete/unknown, never create delete operations.
9. Popup/full-page view shows diff and asks for confirmation.
10. Google writes must never happen solely because DOM changed.

### Google execution location

Two viable v1 choices:

- **Simplest:** extension review opens the GitHub Pages web app, transfers the pending plan through a verified external messaging bridge, and web handles GIS OAuth/REST. Never put the whole timetable or access token in the URL.
- **Alternative:** extension uses `chrome.identity.launchWebAuthFlow`/identity APIs with an extension OAuth client and calls REST directly. This needs separate OAuth config and careful MV3 CSP compliance.

Prefer the web executor unless a focused spike proves direct extension OAuth simpler and reliable for both Chrome and Edge. MV3 must not load remotely hosted executable code.

### Local storage adapter

Implement `KeyValueStorage` around `chrome.storage.local`, then reuse `createProfileStore`.

Do not use `chrome.storage.sync` by default because it uploads timetable state through browser sync.

### Periodic tracking

Do not promise 24/7. First ship opportunistic tracking on page open/mutation. Only add `chrome.alarms` + authenticated fetch after verifying:

- the endpoint is stable;
- current session cookies are available with permitted fetch behavior;
- full unpaginated schedule is returned;
- session-expired response is safely detected;
- MyBK usage policy permits it.

Never store password/cookie values manually.

---

## 10. Google production setup and behavior

### OAuth setup still required from the user

No real Google Cloud/Firebase project exists yet. Do not reuse the upstream hard-coded API key/client ID.

Create documentation and `.env.example`, not secrets. User will need to:

1. Create a Google Cloud project.
2. Enable Google Calendar API.
3. Configure OAuth consent screen as External if ordinary Gmail accounts must work.
4. Add the GitHub Pages origin as authorized JavaScript origin.
5. Publish/test/verify the selected Calendar scope as required by Google.
6. Add test users while consent screen remains in Testing.
7. If extension performs OAuth directly, create/configure the extension-specific OAuth client after extension IDs are stable.

Never commit client secrets, refresh tokens, service-account keys, or private credentials.

Browser OAuth client IDs are public identifiers; API keys, if later needed, must be restricted by origin/API. The current REST-first design does not need `gapi.client` or the old upstream API key.

### Calendar lifecycle

- First confirmed sync creates one dedicated calendar such as `BKalendar • HK 261`.
- Persist returned `calendarId` immediately before inserting events.
- Later syncs target that ID; do not create a new calendar just because lookup/auth failed.
- If calendar access returns 404/403, show a recovery/account message; do not silently create a duplicate.
- Persist accepted snapshot only after the sync result is successful or the user explicitly resolves failures.
- Connect incomplete capture to `allowDeletes:false`.
- Do not touch events missing BKalendar private metadata.

### Legacy migration

Upstream calendars/events have no stable markers and upstream discarded event insert responses. Safe default:

- Create a new managed v2 calendar.
- Leave old calendars untouched.
- Tell user to inspect/hide/delete old calendar manually.

Optional future migration assistant:

- user explicitly selects an old calendar;
- list events;
- heuristic matching by normalized title/time/location/recurrence/description;
- show confidence/ambiguity;
- adopt only explicit/high-confidence events;
- never auto-delete unmatched events.

---

## 11. Apple Calendar scope

v1 means one-time `.ics` import/open.

Recommended UI labels:

- “Apple Calendar và ứng dụng khác”
- “Tải file .ics”
- “Nhập một lần; thay đổi sau này không tự cập nhật.”

On macOS, `.ics` can be dragged/imported into Calendar. On iOS/iPadOS, test download/share behavior and use the Web Share API where supported.

Do not label this as automatic Apple sync.

Future webcal requires a stable HTTPS feed and backend storage. It was explicitly excluded from v1 after choosing no backend.

Official references:

- Apple import: <https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac>
- Apple subscriptions: <https://support.apple.com/guide/iphone/subscribe-to-calendars-iph3d1110d4/ios>
- RFC 5545: <https://www.rfc-editor.org/rfc/rfc5545>

---

## 12. Recommended execution order for Codex

Follow TDD. Production behavior should be preceded by a failing test whenever practical.

### Step 1 — Stabilize repository

1. Inspect all current files before editing.
2. Search and safely remove unreferenced duplicate core files listed above.
3. Initialize git in `bkalendar-next` only if the user wants it; do not publish/push without explicit confirmation.
4. Add LICENSE/NOTICE attribution and README skeleton.
5. Retry `pnpm install`; generate and commit lockfile only after a successful clean install.
6. Run all 28 green tests and preserve them.

### Step 2 — Complete current RED workflow

Implement `apps/web/src/lib/workflow.ts` to satisfy `apps/web/test/workflow.test.ts`.

Then add tests for:

- parser error surfaced without mutating stored profile;
- semester override recomputes `startMondayUTC` before snapshot;
- incomplete capture maps to `allowDeletes:false`;
- successful sync promotes pending to accepted;
- partial failure does not promote accepted snapshot.

### Step 3 — Finish core parity

Port from reference core and test:

- legacy student parser;
- lecturer parser;
- postgraduate parser;
- public source-kind dispatcher/auto-detection.

Add fixtures and preserve existing parsing capability.

Improve identity collision handling for multiple same-course/group/weekday rows and row reordering.

### Step 4 — Web app

Scaffold preferred static SvelteKit shell if registry works; otherwise use Vite + TypeScript without changing domain packages.

Implement:

- import/review/diff/destination/result state machine;
- local profile store;
- timetable diff board;
- ICS Blob/share download;
- GIS lazy-loader and Google sync flow;
- Settings for OAuth client ID/config status, privacy/data reset, extension instructions;
- responsive/accessibility behavior.

### Step 5 — Extension

Implement manifest, content orchestration, storage adapter, background badge, popup/full review, and web sync bridge/direct OAuth decision.

Test against sanitized HTML fixtures and persistent Chromium extension context.

### Step 6 — Release hardening

- Typecheck all packages/apps.
- Formatting/lint.
- Node tests + browser tests.
- Production web build.
- Extension manifest validation and Chrome/Edge zip artifacts.
- GitHub Pages workflow.
- GitHub Actions CI for frozen install/check/test/build.
- OAuth/privacy/deployment/setup documentation.
- Manual Google account matrix and Apple import tests.

---

## 13. Definition of done for MVP

Do not call the project complete until all are true:

- User can paste current MyBK timetable and see parsed review.
- User can import same timetable twice and see zero changes.
- Room/time/week change is shown as changed rather than duplicate event.
- Full schedule removal asks confirmation and deletes only app-managed events.
- Incomplete/paginated capture cannot delete.
- First Google sync creates and remembers one managed calendar.
- Second identical Google sync performs zero writes.
- Changed source patches existing recurring master.
- Removed source deletes only BKalendar-managed master after confirmation.
- Ordinary Gmail and HCMUT account paths use account chooser.
- OAuth/API errors are visible and recoverable.
- ICS downloads with `.ics`, imports into Apple Calendar, preserves Vietnamese text/timezone/recurrence.
- Extension detects changes on current MyBK page and shows a badge/diff.
- No MyBK credentials or Google access tokens are persisted.
- Web builds for GitHub Pages.
- Chrome and Edge extension artifacts build.
- All tests/typechecks/lint/builds pass with evidence.

---

## 14. Known concerns that need review

1. `calendar.app.created` scope behavior must be tested against the final OAuth project.
2. Same-anchor session ordinals are now assigned deterministically across row
   reordering. Truly indistinguishable duplicate meetings and large
   cross-over changes still deserve fixture-based integration coverage.
3. Google RRULE `UNTIL` currently derives from `start + lastWeek`; verify inclusion semantics and end-of-occurrence behavior with real recurring events.
4. `packages/ical/src/index.ts` recurrence also deserves integration testing against Apple/Google Calendar.
5. Source update timestamp is currently required by the current parser; decide whether missing timestamps should be a warning rather than fatal for copied fragments.
6. MyBK table extractor reconstructs tab text; direct structured row parsing may eventually be safer than HTML → text → parser.
7. Footer completeness detection must cover real DataTables variants and “show all rows” behavior.
8. Cross-package source imports use relative `.ts` paths in some files rather
   than package names. Standardize only if it improves packaged builds without
   obscuring the current source-first workspace.

---

## 15. Working rules for Codex

- Treat this document as project context, not permission to publish externally.
- Do not push, create a GitHub repo, deploy, create OAuth projects, or expose credentials without explicit user confirmation.
- Keep the two upstream clones untouched.
- Preserve the full current green test suite.
- Continue from the remaining manual OAuth, MyBK, Apple import, and
  extension-to-web confirmation work.
- Prefer focused, small commits only if the user asks for commits.
- Report tests/builds truthfully; do not claim full verification while registry/OAuth/browser setup remains unavailable.
- Keep UI text in Vietnamese and code identifiers/comments in clear English consistent with surrounding files.
- Maintain local-first privacy and review-before-delete guarantees.

---

## 16. One-paragraph task prompt for Codex

Continue implementing `.` according to this handoff. Preserve the full green
test suite and the local-first/calendar-safety invariants. Focus next on
manual Google OAuth/API validation with a real browser client ID, real MyBK
Chrome/Edge extension testing, an explicit extension-to-web review handoff,
Apple Calendar import validation, and release packaging. Do not store MyBK
credentials or Google tokens. Do not deploy or publish extension-store
artifacts without explicit user approval. Re-run formatting, tests,
typechecks, web/extension builds, responsive browser QA, and integration
matrices before claiming the MVP is complete.
