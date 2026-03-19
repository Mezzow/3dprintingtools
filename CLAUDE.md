# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm install` — install dependencies
- `npm run dev` — start local dev server (Vite, port 5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build locally

No test runner or linter is configured.

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. The site is served under the `/3dprintingtools/` base path (configured in `vite.config.js`).

## Design Principles

- **Target audience:** Non-technical users. Keep the UI simple and approachable.
- **Language:** All UI text must be in German.
- **Minimal defaults:** Show only the essential options by default. Put advanced/power-user options behind a toggle (e.g. "Erweiterte Optionen").
- **Automation:** Automate as much as possible — prefer smart defaults and auto-detection over manual configuration. The user should be able to go from input to STL download with minimal steps.

## Architecture

This is a React 18 + Three.js single-page app for generating 3D-printable STL files.

**Entry point:** `src/main.jsx` — renders a tab-based shell that switches between tools.

**Tools (each is a self-contained React component):**

- `src/App.jsx` — **Bild zu STL (Image to STL):** Converts uploaded images to 3D heightmap STL files. Uses marching squares for contour extraction, Douglas-Peucker simplification, and Three.js for mesh generation and STL export.
- `src/TextCircleTool.jsx` — **Text + Ellipse:** Renders text arranged on an ellipse as a 3D-printable STL. Supports Google Fonts, configurable text/ellipse parameters, and 3D solid fill with connectors.

**Key patterns:**

- Both tools duplicate the contour extraction pipeline (marching squares, segment chaining, Douglas-Peucker). These are not shared — each file contains its own copy.
- All rendering uses canvas-based rasterization → binary image → contour extraction → Three.js geometry → STL export. No server-side processing.
- Styling is inline (no CSS framework). The app uses the Nunito font and a warm beige/brown color scheme.
- Code uses `var` and ES5-style function expressions (no arrow functions, no destructuring in component code).
