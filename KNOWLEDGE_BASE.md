# Net Worth Manager - Knowledge Base & Architecture

## System Architecture

### 1. Backend (Google Apps Script - `Code.gs`)
- **Database**: Serverless Google Sheets. The `setupDatabaseSheets()` function automatically provisions tables for `Team`, `Settings`, `Audit`, `Assets`, `Transactions`, `FamilyProfiles`, and `Events`.
- **API Engine**: Provides generic JSON-based CRUD operations (`getSheetData`, `addRecord`, `updateRecord`, `deleteRecord`). Because it avoids rigid columns for variable data, complex objects are stringified into a `Details JSON` column.
- **RBAC**: The `Team` sheet manages access levels. `readonly` members can view the UI but the `assertWriteAccess` guard will block any mutation attempts.

### 2. Frontend (React + Vite + Tailwind - `ui/`)
- **Single-File Output constraint**: Apps Script can only serve single monolithic HTML pages. We use Vite with `vite-plugin-singlefile` to bundle the entire React tree, Tailwind CSS, and Lucide Icons into a single minified inline `<script>` and `<style>` block within `Index.html`.
- **Build Workaround**: Building directly on the Android SD Card is prohibited because `npm install` requires symlink capabilities which FAT32/exFAT lack. The build pipeline temporarily copies `packages/apps-script/ui` into `/tmp/scratch` (or a linux filesystem), executes the Vite build, and copies the resulting `dist/index.html` back to the project.
- **State Management**: `App.jsx` handles global state and Google Script API polling (`window.google.script.run`).
- **Privacy Masking**: A global toggle replaces sensitive tabular numbers with `₹ ••••••`.

### 3. Native App Wrapper (Expo - `mobile-app/`)
- Provides a shell around the Firebase hosting URL. Includes custom splash screens and `adaptive-icon.png` matching the Net Worth Manager dark branding (Geometric Shield with emerald core).

### 4. Web Portal Wrapper (Firebase - `web-portal/`)
- A minimal wrapper iframe loading the Apps Script URL. Modified to include a custom high-performance SVG `brand-loader` animation matching the app's emerald and indigo design tokens.

## Feature Implementation Status
✅ **Multi-Asset UI**: Integrated Stitch-designed UI tokens. Separated into 4 primary navigation tabs (`Dashboard`, `Assets`, `Spends`, `Safe`).
✅ **Dynamic Database Schema**: Rolled out multi-entity tabs for FamilyOffice structures.
✅ **Privacy Masking**: Implemented one-tap toggle for masking numeric balances.
✅ **Branding & Assets**: Injected custom logo and splash screen.

## Next Iteration Targets
- **Automated Cashflow Ingestion**: Link React Native SMS parsing module to ping the `addRecord('Transactions', ...)` API endpoint.
- **Market Integration**: Configure a timed Google Apps Script Trigger to fetch AMFI NAVs and update the `Current Value` field in the `Assets` table.
