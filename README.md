# FlowPilot AI

A team operations command center: task/course launch tracking (table, kanban, timeline, and
calendar views), time tracking with clock-in/out, daily checklists, an ad-hoc task board, tool
research tracker, weekly planning, a sales forecast view, roles & responsibilities, an intern
portal, and an in-app AI assistant that can answer questions about your live workspace data.

This is a **portfolio/demo edition** of a real internal tool: rebuilt from a single-file app into
a modular project, with all company-specific branding, credentials, and internal data replaced by
fictional placeholders. All names, tasks, and figures shown in the demo are made up.

## Try it in 30 seconds

```bash
npm install
npm run dev
```

No account or API key needed — the app boots straight into **mock mode**, storing everything in
your browser's `localStorage`, pre-populated with fictional sample data (see [Demo login](#demo-login)
below). Nothing here talks to a real backend unless you configure one (see [Using a real Firebase
project](#using-a-real-firebase-project)).

## Demo login

| Role | Username | Password |
|---|---|---|
| Admin | `demo` | `demo1234` |

(Interns sign up for their own account from the "Intern Login" tab on first visit.)

## Tech stack & architecture

- Vanilla JavaScript (ES modules), no UI framework — built with **Vite**.
- Data layer built on a tiny adapter pattern: [`src/services/db.js`](src/services/db.js) picks
  between [`mockBackend.js`](src/services/mockBackend.js) (an in-memory/`localStorage`
  implementation of the 5 Firestore functions the app uses — `doc`, `getDoc`, `setDoc`,
  `onSnapshot`, `writeBatch`) and [`firestoreBackend.js`](src/services/firestoreBackend.js) (the
  real Firebase SDK), selected by environment variable. Every feature module is written against
  that shared interface and doesn't know or care which backend is active.
- Feature code lives under `src/modules/` (one file per feature area: auth, tasks, time
  management, daily tasks, ad-hoc board, tool testing, weekly planning, sales forecast, roles,
  interns, AI assistant), with shared cross-cutting state in `src/state.js` and shared UI helpers
  in `src/utils/`.
- The AI assistant calls the Anthropic API directly from the browser using a key you paste in at
  runtime (stored only in your own `localStorage`, never sent anywhere but `api.anthropic.com`) —
  get one at [console.anthropic.com](https://console.anthropic.com/settings/keys).

```
src/
  main.js              app bootstrap + wiring
  config.js             env-driven config
  state.js               shared cross-module state
  services/               mock/real data-layer adapter
  data/demoSeed.js         fictional sample data
  modules/                 one file per feature area
  utils/                    shared DOM/formatting helpers
  styles/main.css            design system
```

## Using a real Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) and
   enable Firestore.
2. Copy `.env.example` to `.env` and fill in your project's Web app config values.
3. Set `VITE_USE_MOCK=false`.
4. `npm run dev` — the app will now read/write your Firestore project instead of `localStorage`.
   The first admin login will seed a demo account (`demo` / `demo1234`, same as mock mode) since
   your project starts empty.

## Scripts

```bash
npm run dev       # start the dev server
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

## What's fictional here

Every person's name, task, vendor, price, and date shown by default is made up for demo purposes.
This project intentionally ships with **no deployment configuration** (hosting/CI) — it's meant to
be run locally or deployed by whoever forks it, on infrastructure of their own choosing.
