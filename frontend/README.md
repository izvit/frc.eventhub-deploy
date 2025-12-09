# Frontend2 (Vite + React + TypeScript)

Minimal, opinionated scaffold for a medium-sized React + TypeScript app.

Project layout (recommended):

- `src/`
  - `components/` - reusable UI pieces
  - `pages/` - route-level pages or views
  - `layouts/` - layout components (headers/footers)
  - `styles/` - global and shared styles
  - `utils/`, `hooks/`, `services/` - domain folders as needed

Quickstart (Windows PowerShell):

```powershell
cd c:\Users\USER-24-01\ws\repos\calendar_management\frontend2
npm install
npm run dev
```

Scripts:
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — local preview of build
- `npm run lint` — run ESLint
- `npm run format` — run Prettier
- `npm run test` — run Vitest

Notes:
- Uses Vite for fast iteration.
- ESLint + Prettier recommended for consistent code style.
- Add `services/`, `hooks/`, `types/` as the app grows.
