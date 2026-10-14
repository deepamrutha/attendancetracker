# Nihongo Attendance Tracker 🌸

A responsive, installable Progressive Web App for tracking Japanese class attendance.

## Features
- Sakura pink and lavender design
- Historical baseline: 17 conducted, 12 attended, 5 absent as of 14 October 2026
- Dated tracking starts 15 October 2026
- Monday–Friday dates default to present when the app opens; manually recorded absences are preserved
- Mark a weekday present, absent, or holiday/no class
- Monthly calendar, date editor, recent history, and 95% goal calculation
- Local-device storage
- JSON export and restore
- Service worker caches the app shell for offline use after the first successful load
- Imports records from the earlier `sakuratrack.attendance.v1` storage key when available

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the URL Vite prints, normally `http://localhost:5173`.

## Build and test production output
```bash
npm run build
npm run preview
```

## Deploy to Vercel using GitHub
1. Extract the ZIP.
2. Create a GitHub repository named `nihongo-attendance-tracker`.
3. Upload the project files (including `package.json`, `index.html`, `src/`, `public/`, and `vercel.json`) to the repository root.
4. In Vercel, choose **Add New → Project** and import that GitHub repository.
5. Vercel should detect Vite automatically. Confirm:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
6. Click **Deploy**. Open the generated HTTPS URL.

## Install on Android
1. Open the deployed HTTPS URL in Chrome.
2. Open the browser menu (⋮).
3. Choose **Install app** or **Add to Home screen**, depending on Chrome's wording.
4. Launch it from the new home-screen icon.

## Local development
PWA service-worker registration only occurs over HTTPS or localhost. The app still runs without service-worker support, but offline caching requires it.

## Attendance rules
- Baseline is aggregate-only because individual dates for the first 17 classes were not provided.
- New date-based tracking begins on 15 October 2026.
- Monday through Friday dates default to present up through the current local date when the app opens.
- Saved absences and manually marked holidays are not overwritten by weekday defaults.
- Weekends are excluded unless manually changed in a future enhancement.
- The app does not verify actual attendance. Review auto-filled weekdays and mark absences or holidays accurately.
- Data is local to one browser/device. Export backups before clearing browser data or changing devices.
