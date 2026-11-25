# Festize

Festize is a single-page React + TypeScript + Vite application that runs an
entire inter-house arts festival from one browser tab: live championship
standings, program tabulation, multi-stage scheduling, backstage operations,
a poster/badge/certificate design studio, print-ready gazettes, analytics,
a quizmaster stage, a stage stopwatch, and a tabulation toolkit.

## Quick start

```bash
npm install
npm run dev        # start the Vite dev server
npm run build      # production build (single-file bundle in dist/)
npm run preview    # preview the production build
```

Open the dev server URL (default `http://localhost:5173`). All workspace
state is persisted automatically to `localStorage` — no account needed.

## Environment variables

Copy `.env.example` to `.env`. Everything is optional:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Enables optional Supabase cloud snapshots of the workspace |
| `VITE_SUPABASE_ANON_KEY` | Anon key for the same Supabase project |

Without Supabase env vars, Festize runs fully offline.

## Optional Supabase setup

```bash
supabase start        # local stack (see supabase/config.toml)
supabase db reset     # applies supabase/migrations/0001_festize_workspace_snapshots.sql
```

Then put the printed `API URL` and `anon key` into `.env` as
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. The **Tabulation Toolkit**
then shows *Save to Cloud* / *Load from Cloud* buttons that sync the whole
workspace JSON to the `festize_workspace_snapshots` table.

## Project structure

```
├── index.html                  # entry HTML (title, fonts, meta)
├── .env.example                # env var template
├── supabase/                   # optional Supabase local config + migrations
│   ├── config.toml
│   └── migrations/0001_festize_workspace_snapshots.sql
└── src/
    ├── main.tsx                # React root bootstrap
    ├── App.tsx                 # app shell: Landing ↔ Workspace view switch
    ├── Landing.tsx             # marketing/hero landing page
    ├── Intro.tsx               # first-run onboarding tour overlay
    ├── Workspace.tsx           # workspace shell: sidebar nav + section router
    ├── FestizeLogo.tsx         # brand logo lockup (SVG)
    ├── ThemePicker.tsx         # workspace theme swatch picker
    ├── types.ts                # central re-export of shared domain types
    ├── ui.tsx                  # shared UI primitives (Button, Card, Input...)
    ├── vite-env.d.ts           # Vite client + env typings
    ├── index.css               # Tailwind v4 import + Festize theme tokens
    ├── supabase.ts             # optional Supabase client + snapshot helpers
    ├── utils/cn.ts             # clsx + tailwind-merge helper
    ├── lib/                    # domain utilities & configuration
    │   ├── brand.ts            #   festival brand kit & palette presets
    │   ├── contrast.ts         #   WCAG 2.1 contrast engine
    │   ├── exporter.ts         #   SVG/PNG/CSV/JSON/print exporters
    │   ├── fast.ts             #   points matrix + fast result shorthand parser
    │   ├── fonts.ts            #   studio typefaces & font pairings
    │   ├── persistence.ts      #   versioned localStorage persistence
    │   ├── settingsFonts.ts    #   UI typography & density settings
    │   ├── shapes.tsx          #   vector festival shape library (React + SVG)
    │   └── theme.ts            #   workspace light/dark themes
    └── sections/               # the 14 application modules
        ├── common.ts           #   shared types, standings, seed state
        ├── Highlights.tsx      #   championship standings & result gazette
        ├── Programs.tsx        #   programs registry & fast tabulation desk
        ├── ScheduleAdvanced.tsx#   multi-stage timeline + clash engine
        ├── Operations.tsx      #   backstage command center
        ├── NewDocumentDialog.tsx#  studio artboard creation modal
        ├── Designer.tsx        #   poster/badge/certificate studio
        ├── Printouts.tsx       #   jury sheets, call sheets, gazettes, slips
        ├── Insights.tsx        #   analytics dashboard
        ├── Prediction.tsx      #   what-if championship simulator
        ├── Quiz.tsx            #   quizmaster stage & buzzer scoreboard
        ├── Stopwatch.tsx       #   stage timekeeper with cue bells
        ├── Tools.tsx           #   cipher draw, score normalizer, backup
        └── Setup.tsx           #   festival profile, houses, themes, points
```

## Keyboard shortcuts

- `⌘K` / `Ctrl+K` — quick-jump command palette (modules & programs)
- `Esc` — close dialogs

## Tech stack

- **React 19** + **TypeScript** (strict)
- **Vite 7** with `vite-plugin-singlefile` (produces one self-contained `dist/index.html`)
- **Tailwind CSS v4** (`@tailwindcss/vite`) with CSS-variable theming
- **lucide-react** icons, **@supabase/supabase-js** (optional cloud sync)
