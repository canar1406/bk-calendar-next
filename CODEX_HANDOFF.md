# BKalendar Next - Project Handoff

Updated: October 25, 2026, Asia/Ho_Chi_Minh.

Start here when continuing this project. This handoff describes the local
working tree, not a released version. The earlier handoff is preserved at
`docs/handoffs/2026-10-25-previous-handoff.md` for historical context.

## 1. Current State

- Workspace: `/Users/Heavietnam/Desktop/BK caledar remake/bkalendar-next`.
- Git root is this directory; the parent directory is not the repository.
- Branch: `main`.
- HEAD: `8feb6b7555550f9b68dc4bab014e309e02560203`.
- Work remains uncommitted. No commit, push, or deployment was requested.
- Preserve existing changes. Do not reset files, discard untracked files,
  regenerate the app, or replace credentials.
- This handoff pass changes documentation only; it does not fix another feature.
- The user explicitly requested a complete project handoff after delays.

## 2. Product And Workspace

BKalendar Next imports HCMUT/MyBK schedules, previews calendar occurrences,
exports ICS and PNG, and synchronizes a managed Google Calendar.
Class timetables and exam schedules are separate inputs and separate profiles.
Exams have fixed dates, start times, durations, and GK/CK types.
Do not route exam rows through the recurring class timetable parser.

| Directory                  | Responsibility                                             |
| -------------------------- | ---------------------------------------------------------- |
| `apps/web`                 | SvelteKit/Svelte 5 frontend, static build, browser storage |
| `apps/extension`           | Chromium MV3 capture, web handoff, Google integration      |
| `packages/core`            | Source detection, timetable parsers, exam parser           |
| `packages/timetable`       | Shared models, keys, occurrences, storage, transfer        |
| `packages/google-calendar` | OAuth, REST, quota handling, reconcile/sync                |
| `packages/ical`            | ICS generation and interoperability tests                  |
| `fixtures`                 | Class schedules and exam regression inputs                 |
| `scripts`                  | Extension bundling, deterministic ZIP, checks              |
| `.github/workflows`        | CI and GitHub Pages deployment                             |

Toolchain: pnpm workspace, TypeScript, Node 24, Vite, static adapter.
Root `package.json` pins `pnpm@11.19.0`; follow the manifest and lockfile.

## 3. Run And Build

Use Node 24+ and the pnpm version in `package.json`.

```sh
cd '/Users/Heavietnam/Desktop/BK caledar remake/bkalendar-next'
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm --filter @bkalendar-next/web dev --host 127.0.0.1 --port 4173
```

For the same base path used by GitHub Pages:

```sh
BASE_PATH=/bk-calendar-next pnpm --filter @bkalendar-next/web build
BASE_PATH=/bk-calendar-next pnpm --filter @bkalendar-next/web preview --host 127.0.0.1 --port 4174 --strictPort
```

Preview URL: `http://127.0.0.1:4174/bk-calendar-next/`.
Restart preview after rebuilding; an old server can reference obsolete asset hashes.

- Extension build: `pnpm --filter @bkalendar-next/extension build`.
- ZIP packaging: `pnpm package:extension`.
- Generated extension: `apps/extension/dist/`.
- Published ZIP: `apps/web/static/downloads/bkalendar-next-extension.zip`.
- Static web output: `apps/web/build/`.
- Do not track generated files or change OAuth configuration without approval.

## 4. Architecture

Configuration and deployment references:

- `apps/web/.env.example`: copy to `.env` locally and set
  `PUBLIC_GOOGLE_CLIENT_ID` when using real Google login. Never store tokens.
- `apps/extension/manifest.json`: extension OAuth client, scopes, host permissions.
- `VITE_WEB_APP_URL`: extension-to-web destination at extension build time.
- `.github/workflows/ci.yml`: frozen-lockfile install, lint, tests, build.
- `.github/workflows/pages.yml`: extension ZIP and static site publication;
  production base path is `/bk-calendar-next`. User approval is still required
  before intentionally pushing changes that trigger publication.

MyBK capture/paste -> source-specific parser -> timetable snapshot -> preview/diff
-> Google reconcile, ICS export, or PNG rendering.

- Web entry: `apps/web/src/routes/+page.svelte`; workflow: `apps/web/src/lib/workflow.ts`.
- Parser selection: `packages/core/src/source-snapshot.ts` and `parser/dispatcher.ts`.
- Storage and handoff: `packages/timetable/src/storage.ts` and `transfer.ts`.
- Sync: `packages/google-calendar/src/profile-sync.ts`, `reconcile.ts`, `rest.ts`.
- Keep class and exam profiles separate. Stable event identity must survive re-import.

## 5. Exam Import And The User's Actual Table

The user reports an EXAM import problem, not an OAuth problem. Earlier responses
misread screenshots and wasted time. Do not conflate exams with class timetables.

- Exam parser: `packages/core/src/parser/exam.ts`.
- Exam source detection: `packages/core/src/source-snapshot.ts`.
- Web ingestion: `apps/web/src/lib/workflow.ts`.
- Extension capture: `apps/extension/src/content/extract.ts` and
  `apps/extension/src/background/capture-workflow.ts`.
- Regression tests: `packages/core/test/exam.test.ts`.
- Real table fixture: `fixtures/mybk-exams-20261.md` (9 rows, no account identity).
- Earlier synthetic example: `fixtures/mybk-exams-261.txt`.

Actual MyBK columns:

```text
Hoc ky | Mon hoc | Nhom lop | Ngay thi | Loai thi | Co so | Ma phong |
Thu | Gio bat dau | Tong so phut | Cap nhat cuoi cung vao luc
```

The parser handles Markdown pipe rows and tab-separated text, combined course
code/title, semester `20261` -> `261`, ISO dates, `09g00`, duration and room/campus.
GK and CK are separate dated events, not weekly class recurrence. Unknown dates
are not invented. Mixed semesters and mismatched overrides are rejected.

Checked example: MT1003, GK, October 13, 2026, 09:00-09:50 Asia/Ho_Chi_Minh,
room H6-802, campus BK-CS2; expected UTC start `2026-10-13T02:00:00.000Z`.
A prior local browser smoke check reported all 9 exams imported. This handoff
reran automated tests/builds, not the user's entire screenshot workflow.

The last screenshot has NOT been diagnosed or resolved. Original local attachment:
`/var/folders/rb/vdhjm2z16lddch844hb4h5hh0000gp/T/codex-clipboard-245256dd-f7b8-439d-9386-fb2ddb78d80d.png`.
Temporary attachments may disappear; preserve relevant evidence before relying on it.

## 6. Other Working-Tree Features

### PNG wallpaper

- `apps/web/src/lib/wallpaper.ts`, `components/WallpaperExport.svelte`.
- Phone 1080 x 2400; desktop 2560 x 1440; light/dark; course colors/icons.
- Classes export the selected week; exams export dated exam events.
- Unit tests: `apps/web/test/wallpaper.test.ts`.
- Sample/empty snapshots are guarded. Check dense schedules and unusually long
  titles visually before promising all content fits every wallpaper.
- `ScheduleBoard.svelte` also has appearance reactivity changes.

### ICS

- `packages/ical/src/index.ts`, `apps/web/src/lib/ical-download.ts`.
- Concrete occurrences; UTC date-times; deterministic UID; CRLF; escaping and
  UTF-8 folding. No recurring RRULE or scheduling METHOD.
- Independent-parser tests: `packages/ical/test/compatibility.test.ts` (`ical.js`).
- Real Apple Calendar and Google Calendar imports still need user confirmation.

### Google auth, quota, and profile isolation

- `packages/google-calendar/src/oauth.ts`, `auth-errors.ts`, `rest.ts`.
- Web: `apps/web/src/lib/google-identity.ts`, route handling.
- Extension: `apps/extension/src/background/google-auth.ts`.
- Avoid duplicate token requests; distinguish OAuth consent/configuration errors
  from Calendar API throttling; bounded retry for transient quota failures.
- Required scopes are defined in the OAuth module and extension manifest.
- `profile-sync.ts` separates class and exam profiles; do not let exam sync reuse
  the old timetable calendar. Handoff validation retains schedule kind.
- OAuth app verification, test-user membership, and provider-enforced user caps
  are external configuration, not bypassable by retries. No Cloud settings were
  changed; real account login/sync remains unverified in this handoff.

## 7. Verification And Remaining Acceptance

Re-executed October 25, 2026:

| Check                                                                 | Result                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm test`                                                           | 312 tests, 66 suites, 312 passed, 0 failed           |
| `pnpm lint`                                                           | passed; Svelte check reports 0 errors and 0 warnings |
| `pnpm build`                                                          | passed                                               |
| `BASE_PATH=/bk-calendar-next pnpm --filter @bkalendar-next/web build` | passed                                               |

This supersedes earlier test counts. Build success is not proof that every
reported issue is resolved. Remaining acceptance:

1. Inspect the most recent screenshot; reproduce its exact problem on the real
   MyBK data before editing. Do not assume it concerns OAuth.
2. Check full copied exam page and direct table paste, automatic detection and
   explicit Exams selection. Expect 9 dated GK/CK events, correct room/time.
3. Confirm class timetable imports still work independently.
4. Visually check phone/desktop PNGs with actual dense schedules.
5. Import actual downloaded ICS files into Apple and Google Calendar.
6. Verify real OAuth login/sync with an authorized account; do not change the
   user's external calendars without approval.

Temporary logs from this verification live under `/tmp/bkalendar-handoff-*.log`.
They are not durable project artifacts.

## 8. Working Tree Inventory

All functional edits remain uncommitted. Use `git status --short` and review the
actual diff rather than assuming this inventory is a patch to reapply.

- Web: route/CSS; board appearance; Google identity; ICS download; import workflow;
  PNG renderer/component/tests; Google and workflow tests.
- Extension: extraction; capture workflow; OAuth; calendar selection/recovery;
  extraction and OAuth tests.
- Core: exam parser/tests; source snapshot selection.
- Timetable: optional exam kind/metadata; storage and transfer validation/tests.
- Google package: OAuth errors/request flow; REST retry; profile sync; tests.
- ICS: exporter; compatibility tests and dev dependency; pnpm lockfile.
- Docs/CI: README, CI install mode; current handoff and archived prior handoff.
- Fixtures: synthetic exam TSV and real MyBK exam Markdown.

No commit, push, deploy, account configuration change, or destructive Git action
was performed during this handoff. Preserve all existing worktree changes.

## 9. Resume Prompt

```text
Read CODEX_HANDOFF.md and inspect the current dirty diff before editing. Work in
/Users/Heavietnam/Desktop/BK caledar remake/bkalendar-next on main, without
resetting or discarding changes. Read README for setup and deployment details.
The reported issue concerns the exam schedule; class schedules are a separate
format. The real 9-row exam fixture is fixtures/mybk-exams-20261.md. First inspect
the last screenshot and reproduce its exact failure. Automated checks pass, but
real Apple/Google imports and real OAuth account sync are not confirmed. Keep
scope narrow, explain the concrete change, and ask for user confirmation where
needed. Do not commit, push, deploy, or change external account data unasked.
```

Historical detail: `docs/handoffs/2026-10-25-previous-handoff.md` (not current state).
