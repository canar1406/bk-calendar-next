# BKalendar Next

BKalendar Next converts HCMUT/MyBK timetable data into a reviewable schedule,
tracks changes locally, safely reconciles app-managed Google Calendar events,
and exports standards-compliant `.ics` files for Apple Calendar and other
calendar applications.

The project is under active development. See `CODEX_HANDOFF.md` for the product
decisions, current implementation status, and MVP definition of done.

## Principles

- Local-first MVP with no Firebase or application backend.
- No storage of MyBK passwords, session cookies, Google access tokens, or
  refresh tokens.
- Google Calendar writes require explicit confirmation.
- Incomplete or unknown timetable captures can never authorize deletions.
- Re-importing an identical timetable performs zero managed-calendar writes.
- The two sibling upstream repositories are read-only references.

## Workspace

```text
apps/
  web/                 Static SvelteKit web application
  extension/           Chrome and Edge Manifest V3 extension
packages/
  core/                MyBK parsing, resolution, and snapshot conversion
  timetable/           Stable identity, diffing, and local profile storage
  google-calendar/     OAuth, REST gateway, and reconciliation
  ical/                RFC 5545 output
```

## Development

Requirements:

- Node.js 24
- pnpm 11.19.0

```bash
pnpm install
pnpm test
pnpm check
pnpm build
```

Run the web application:

```bash
pnpm dev
```

## Browser extension

Build the Manifest V3 extension:

```bash
pnpm --filter @bkalendar-next/extension build
```

Load the generated `apps/extension/dist` directory as an unpacked extension:

- Chrome: open `chrome://extensions`, enable Developer mode, then choose
  **Load unpacked**.
- Edge: open `edge://extensions`, enable Developer mode, then choose
  **Load unpacked**.

The extension requests only local storage and the specific MyBK timetable
page. It detects and reviews changes locally; it does not silently write to
Google Calendar.

Create one ZIP compatible with both Chrome and Edge:

```bash
pnpm package:extension
```

The package is written to:

```text
artifacts/bkalendar-next-extension-chrome-edge.zip
```

CI also uploads this ZIP as the `bkalendar-next-extension-chrome-edge`
workflow artifact.

## Google OAuth

No credentials are committed to this repository. A browser OAuth client must
be created in Google Cloud with the Calendar API enabled. Ordinary Gmail and
HCMUT Google Workspace accounts use the same account chooser; the application
must not set a hosted-domain restriction.

Copy `.env.example` to `.env` and replace the sample public client identifier:

```bash
PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Never put a client secret, access token, refresh token, or API key in this
file.

## Apple Calendar

The MVP provides a one-time `.ics` download/import. It does not provide webcal,
CalDAV, or automatic Apple Calendar synchronization.

## License and attribution

MIT. See `LICENSE` and `NOTICE`.
