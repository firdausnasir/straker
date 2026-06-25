# Commitment Tracker

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Data Class: D4
Blast Radius: B1
AI Mode: generate

Personal finance tracker — subscriptions, recurring bills, loans. Multi-currency
(MYR, USD), no FX. Email/password auth, dashboard sorted by next due date.

- **Tier:** B (personal feature work)
- **Data Class:** D4 — stores password hashes + financial commitment amounts
- **Blast Radius:** B1 — single-user, local

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- Prisma + **SQLite** — a single file DB (`DATABASE_URL=file:...`; relative
  paths resolve against `prisma/`). No DB server, no connection pooler, no
  `DIRECT_URL`. Single-user/local (Blast Radius B1).
- Tailwind v4 · shadcn/ui (`src/components/ui/`) · lucide-react
- **Earthy Soft** design system — warm sand page, parchment cards lifting on
  soft umber-tinted shadows, generous rounded corners, single terracotta (clay)
  accent mapped onto shadcn `--primary`. Display type Fraunces, body Inter (both
  `next/font/google`). Light + dark mode toggled by a `.dark` class on `<html>`
  (no-flash inline script in `layout.tsx`; `useTheme` via `useSyncExternalStore`
  reads it).
- Auth: **NextAuth (Auth.js v5)**, Credentials provider, JWT sessions.
  `src/auth.ts` (full, Prisma + bcrypt via `src/lib/password.ts`) + edge-safe
  `src/auth.config.ts` (shared with the proxy). Registration is at
  `/api/register` (Auth.js owns `/api/auth/*`). `trustHost: true` for self-host.
  Behind a reverse proxy, **set `AUTH_URL` to the public origin**: the proxy
  middleware builds the login `callbackUrl` from `reqWithEnvURL`, which only
  honors `AUTH_URL`/`NEXTAUTH_URL` (NOT `X-Forwarded-Host`/`trustHost`), so
  without it the callback falls back to the container's internal
  `localhost:3000`.
- Route protection: `src/proxy.ts` (Next 16 middleware) runs Auth.js's
  `authorized` callback — optimistic redirect to `/login`. API routes also
  self-check via `auth()`; the create route catches Prisma P2003 (token valid
  but user gone) → 401, and the client signs out on 401.
- Passkeys (WebAuthn, `@simplewebauthn` v9 — pinned to match next-auth's
  optional peer): **one passkey per account** (`Credential`, `userId @unique`).
  Custom flow bridged into a second `passkey` Credentials provider — NOT
  next-auth's experimental webauthn provider, so the JWT-only model + no DB
  adapter stay intact. Verify routes mint a 60s signed token
  (`src/lib/passkey-token.ts`); the client exchanges it via `signIn("passkey")`.
  Challenges live in a signed, httpOnly 5-min cookie (`src/lib/webauthn.ts`);
  RP ID + origin are derived from the request `Origin` header (no env var).
  Routes: `register/options|verify` (authed + password), `login/options|verify`
  (public), `credential` GET/PATCH/DELETE. **Add/renew/delete re-prove the
  password** (the session JWT is ~permanent); rename does not. Add + renew share
  one flow: password → ceremony → a modal that pre-fills a *guessed* device name
  (`guessPasskeyName`, from transports + UA) for the user to confirm/edit.
  Never log the `credentialId` or public key. UI: button on `/login`,
  management in Settings (`src/components/passkey-settings.tsx`).
- Pages: `/` Subs · `/analytics` (monthly-normalized totals per currency) ·
  `/settings` · `/login`. Bottom pill tab dock (`src/components/tab-bar.tsx`),
  full-width on mobile. Mobile-first: ≥44px tap targets across primitives.
- Theme follows device by default (`system`), live via `matchMedia`; override
  to light/dark in Settings. `useTheme` (`src/components/theme.tsx`).
- Tests: `tests/smoke.mjs` — Playwright end-to-end (register → add → sort →
  date picker). Run a prod/dev server, then `node tests/smoke.mjs`.

## Money rule (non-negotiable)

Amounts are **integer minor units** (`amountMinor`) + ISO-4217 code. Never float.
Conversion + formatting live in `src/lib/money.ts`. No FX — each amount is exact
in its own currency.

## Layout

- `src/lib/` — domain logic: `constants`, `money`, `cycle`, `dates`, `auth`,
  `validation` (zod at every API boundary), `commitments` (auto-renew + query)
- `src/app/api/` — route handlers (auth, commitments CRUD, renew)
- `src/components/` — client UI (dashboard, card, quick-add dialog)

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (proving command)
- `npx prisma studio` — inspect the DB
- `npx prisma migrate deploy` — apply committed migrations to the DB
- `npx prisma migrate status` — show which migrations are applied

## PWA + Web Push

- Installable PWA: `src/app/manifest.ts` (Next metadata route) + brand icons in
  `public/icons/` (regenerate with `node scripts/generate-icons.mjs`).
- Service worker `public/sw.js` handles **push + notificationclick only** — no
  fetch caching on purpose (a finance app must never show stale due dates).
  Registered client-side by `src/components/pwa/service-worker-register.tsx`.
- Reminders are **per-commitment** (`reminderEnabled` + `reminderLeadDays`, 0–7;
  0 = remind on the due date itself), sent **once per due date** via the
  `reminderSentForDueDate` gate (re-arms when
  the date advances). Device must be enabled in Settings → Notifications to receive.
- Send lib: `src/lib/push.ts` (`sendPushToUser`, prunes 404/410). Endpoints are
  bearer secrets — never log endpoint/keys/payload.
- Secrets: `node scripts/setup-push-env.mjs` generates VAPID keys + `CRON_SECRET`
  into `.env` (idempotent, never prints values). Required vars: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
  Replicate them on the deploy host.
- Schedulers: **two** cron routes, both guarded by `Authorization: Bearer
  $CRON_SECRET` (Vercel injects the bearer automatically; NOT behind user auth):
  - `GET /api/cron/advance-cycles` — rolls lapsed AUTO commitments forward
    (`advanceLapsedAutoCommitments`, all users). `vercel.json` runs it daily
    16:10 UTC (00:10 MYT). This is the **only** place AUTO dates advance.
  - `GET /api/cron/due-reminders` — sends due reminders. Runs daily 01:00 UTC
    (09:00 MYT) — after advance-cycles in the MYT day, so it scans fresh dates.
  - Self-host: hit both from system cron, e.g.
    `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/advance-cycles`.

## Notes

- AUTO commitments advance only via the `advance-cycles` cron (see above);
  reads (`getActiveCommitments`) never write. With no cron running, AUTO due
  dates stay frozen in the past. MANUAL ones advance only via the renew action.
- `AUTH_SECRET` must be ≥ 32 chars or auth flows throw at startup. It also signs
  the passkey challenge cookies + the 60s passkey login token.

<!-- dgc-policy-v11 -->
# Dual-Graph Context Policy

This project uses a local dual-graph MCP server for efficient context retrieval.

## MANDATORY: Always follow this order

1. **Call `graph_continue` first** — before any file exploration, grep, or code reading.

2. **If `graph_continue` returns `needs_project=true`**: call `graph_scan` with the
   current project directory (`pwd`). Do NOT ask the user.

3. **If `graph_continue` returns `skip=true`**: project has fewer than 5 files.
   Do NOT do broad or recursive exploration. Read only specific files if their names
   are mentioned, or ask the user what to work on.

4. **Read `recommended_files`** using `graph_read` — **one call per file**.
   - `graph_read` accepts a single `file` parameter (string). Call it separately for each
     recommended file. Do NOT pass an array or batch multiple files into one call.
   - `recommended_files` may contain `file::symbol` entries (e.g. `src/auth.ts::handleLogin`).
     Pass them verbatim to `graph_read(file: "src/auth.ts::handleLogin")` — it reads only
     that symbol's lines, not the full file.
   - Example: if `recommended_files` is `["src/auth.ts::handleLogin", "src/db.ts"]`,
     call `graph_read(file: "src/auth.ts::handleLogin")` and `graph_read(file: "src/db.ts")`
     as two separate calls (they can be parallel).

5. **Check `confidence` and obey the caps strictly:**
   - `confidence=high` -> Stop. Do NOT grep or explore further.
   - `confidence=medium` -> If recommended files are insufficient, call `fallback_rg`
     at most `max_supplementary_greps` time(s) with specific terms, then `graph_read`
     at most `max_supplementary_files` additional file(s). Then stop.
   - `confidence=low` -> Call `fallback_rg` at most `max_supplementary_greps` time(s),
     then `graph_read` at most `max_supplementary_files` file(s). Then stop.

## Token Usage

A `token-counter` MCP is available for tracking live token usage.

- To check how many tokens a large file or text will cost **before** reading it:
  `count_tokens({text: "<content>"})`
- To log actual usage after a task completes (if the user asks):
  `log_usage({input_tokens: <est>, output_tokens: <est>, description: "<task>"})`
- To show the user their running session cost:
  `get_session_stats()`

Live dashboard URL is printed at startup next to "Token usage".

## Rules

- Do NOT use `rg`, `grep`, or bash file exploration before calling `graph_continue`.
- Do NOT do broad/recursive exploration at any confidence level.
- `max_supplementary_greps` and `max_supplementary_files` are hard caps - never exceed them.
- Do NOT dump full chat history.
- Do NOT call `graph_retrieve` more than once per turn.
- After edits, call `graph_register_edit` with the changed files. Use `file::symbol` notation (e.g. `src/auth.ts::handleLogin`) when the edit targets a specific function, class, or hook.

## Context Store

Whenever you make a decision, identify a task, note a next step, fact, or blocker during a conversation, call `graph_add_memory`.

**To add an entry:**
```
graph_add_memory(type="decision|task|next|fact|blocker", content="one sentence max 15 words", tags=["topic"], files=["relevant/file.ts"])
```

**Do NOT write context-store.json directly** — always use `graph_add_memory`. It applies pruning and keeps the store healthy.

**Rules:**
- Only log things worth remembering across sessions (not every minor detail)
- `content` must be under 15 words
- `files` lists the files this decision/task relates to (can be empty)
- Log immediately when the item arises — not at session end

## Session End

When the user signals they are done (e.g. "bye", "done", "wrap up", "end session"), proactively update `CONTEXT.md` in the project root with:
- **Current Task**: one sentence on what was being worked on
- **Key Decisions**: bullet list, max 3 items
- **Next Steps**: bullet list, max 3 items

Keep `CONTEXT.md` under 20 lines total. Do NOT summarize the full conversation — only what's needed to resume next session.
