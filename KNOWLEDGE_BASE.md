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

## Feature Update (v2.5) - Live Market Valuation Engine (Issue #8)
✅ **Google Finance & AMFI Integration**: Created automated `MarketQuotes` database tab maintaining real-time formulas (`=GOOGLEFINANCE(...)`) for stocks and precious metals. Gold rates for 24K, 22K, and 18K are dynamically computed per gram from `CURRENCY:XAUINR` with purity selector support (Coins/Bars 24K, Jewelry 22K).
✅ **AMFI Mutual Funds Direct NAV & Instant Search**: Integrated live AMFI NAV fetching and instantaneous scheme search via official endpoints. Supports entering or selecting AMFI scheme codes with automatic NAV lookup.
✅ **Dynamic Valuation & P&L Analytics**: Assets in Equity, Mutual Funds, and Gold automatically calculate their `Current Value = Units/Qty/Weight × CMP`. Individual asset cards display live pulsing badges, holding summaries, CMP, and total return (P&L and P&L %).
✅ **Consolidated Net Worth Sync**: Consolidated Net Worth in HomeTab reflects live market valuations and includes Mutual Funds and liabilities accurately. Added a "Sync Rates" action in AssetsTab that persists live computed market values directly to the Google Sheet.

## Feature Update (v2.0)
✅ **Restored Base UX Features**: Re-implemented `react-swipeable` for seamless swiping between navigation tabs. Added user avatar, active session modal, expandable header menus, and a pulsing live sync indicator to restore the original responsive prototype feel. Fixed gesture collision bugs by isolating scroll containers.
✅ **Dynamic Data Binding**: UI components now directly consume data from Google Apps Script (`window.google.script.run.getDashboardData`). Hardcoded fallback values are preserved for testing out of the Google Apps Script context.
✅ **Dynamic Asset Schemas**: Shifted from generic forms to category-specific granular entry screens (e.g., FDs require maturity dates, Real Estate requires 7/12 extracts). Granular form fields are packed into the `Details JSON` column to prevent Google Sheets column bloat.
✅ **Family Safe & Drive API**: Transformed the Safe tab into a secure document vault. Documents are uploaded directly to the owner's Google Drive via `Drive.gs`, bypassing Apps Script storage limits.
✅ **Dynamic Environment Routing**: The `Drive.gs` backend inspects the connected spreadsheet's name. If it contains "UAT", uploads are routed to `Net Worth Manager -> UAT -> Family Safe -> [Category]`. Otherwise, they go to `PROD`.
✅ **CI/CD Fixes**: Modified `.claspignore` to explicitly include all `*.gs` files to ensure new backend services are deployed. `appsscript.json` explicitly declares required OAuth scopes to force permission sync across the Web App deployment.
