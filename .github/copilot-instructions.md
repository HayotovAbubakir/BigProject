# Copilot instructions for BigProject

This file gives focused, actionable guidance for AI coding agents working in this repository.

- Purpose: React + Supabase inventory app. Primary backend is Supabase (see `supabase/`).
- Start here: `README.md` for setup; `package.json` scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`.

- Environment: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` in `.env` (see `README.md`). Many modules check for placeholder values.

- Key integration points:
  - Supabase client: `supabase/supabaseClient.js` — prefer editing this for client config.
  - Database schema and seeds: `supabase/schema.sql`, `supabase/init_admins.sql`.
  - Runtime state helpers: `src/firebase/db.js` (loads/saves `app_states` table).

- Architecture / code layout:
  - UI pages: `src/pages/*` (e.g. `Credits.jsx`, `Dashboard.jsx`, `Store.jsx`).
  - Shared components: `src/assets/components/` and `src/components/` (there are duplicates; check imports to determine which is active).
  - App contexts: `src/context/` (authentication, locale, notifications, theme). Use these when modifying cross-cutting behaviour.
  - Supabase helpers: many helper modules live under `src/firebase/` (named `supabase*`); they call `supabase/supabaseClient.js`.

- Project-specific conventions and patterns:
  - Admin-first auth: accounts are created by admins (see `supabase/init_admins.sql` and README). There is no email self-registration.
  - State persistence: application-level UI/feature state is serialized to `app_states.state_json` (see `src/firebase/db.js`). Keep payloads JSON-safe.
  - Vite import aliasing: code uses absolute imports like `/supabase/supabaseClient` — resolve paths relative to project root under Vite.
  - Duplicate backups: `comment_backups/` contains older copies — avoid editing those.

- Developer workflows (quick):
  - Install: `npm install`
  - Run locally: `npm run dev` (Vite)
  - Build: `npm run build`
  - Lint: `npm run lint`

- Troubleshooting notes for agents:
  - If Supabase appears unconfigured, check `.env` variables and `supabase/supabaseClient.js` (it logs when `DEV`).
  - If state fails to load, inspect `src/firebase/db.js` — it falls back to `username='shared'` and logs parse errors.
  - When adding DB changes, update `supabase/schema.sql` and mention migration steps in PR description.

- When modifying UI components:
  - Prefer changes inside `src/assets/components/` or `src/components/` depending on which path the page imports; run a workspace search for the component import to confirm.
  - Update corresponding context providers in `src/context/` when introducing global state or auth changes.

- Files to reference for examples:
  - `supabase/supabaseClient.js` — client setup and config checks
  - `src/firebase/db.js` — state save/load patterns and error handling
  - `supabase/schema.sql` and `supabase/init_admins.sql` — table shapes and initial admin accounts
  - `src/pages/Credits.jsx` — example page wiring into contexts and forms

- PR guidance for agents:
  - Keep changes minimal and focused; mention env changes and DB migrations in PR body.
  - Run `npm run lint` before proposing code changes.

If anything here is unclear or you want extra examples (component edit walkthrough, adding a Supabase query helper, or testing steps), tell me which section to expand.
