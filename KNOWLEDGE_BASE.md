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

## Feature Update (v3.0) - Dedicated Retirement & Pension Hub (EPF, VPF, PPF & NPS) (Issue #23)
✅ **Retirement & Pension Mathematical Engine (`retirementMath.js`)**:
  - **EPFO Running Accrual Engine**: Models monthly running balance interest compounding at 8.25% p.a., eliminating the passbook credit lag so users have an up-to-date real-time net worth figure throughout the financial year.
  - **NPS Look-Through Asset Class Deconstruction**: Deconstructs NPS Tier 1 and Tier 2 holdings into underlying Equity (Class E, up to 75%) vs Fixed Income (Corporate Debt Class C & Govt Sec Class G), feeding directly into the Portfolio Rebalancer for true unskewed asset allocation.
  - **Age 60 Retirement & Monthly Pension Forecaster**: Projects compound future value accumulation with annual step-up escalation, calculating the PFRDA 60% Tax-Free Lump Sum payout and 40% Mandatory Lifetime Annuity Monthly Pension (at 7.0% annuity yield).
  - **Tax Exemption & Salary Perk Auditor**: Audits utilization of Section 80C (EPF/PPF up to ₹1.5L), Section 80CCD(1B) (exclusive ₹50,000 NPS Tier 1 deduction), and Section 80CCD(2) (Corporate Employer NPS up to 10% of salary with zero cap under 80C), plus Rule 9D taxable EPF alerts.
✅ **Granular Dynamic Schemas (`assetSchemas.js` & `DynamicForm.jsx`)**:
  - First-class `Retirement & Pension` category with tailored sub-types for EPF/VPF, NPS Tier 1, NPS Tier 2, PPF, and Superannuation/Gratuity.
  - Sub-ledger fields for Employee Share, Employer Share, EPS Pension Fund, PRAN/UAN, PFM picker, and E/C/G asset allocation weights.
✅ **Interactive UI / UX (`RetirementPlannerModal.jsx`)**:
  - Full support for dark OLED mode, clean light mode, and responsive desktop/mobile layouts.
  - Consolidated Hero Card with monthly inflow, accrued interest counter, and debt vs equity progress bar.
  - Deep Account Cards with copyable UAN/PRAN, sub-ledger tags, and tax verification badges.
  - Dynamic retirement age and step-up annual escalation sliders with instant pension recalculation.
  - Direct integration into `HomeTab`, `AssetsTab`, and `SettingsTab`.

## Feature Update (v2.9) - AI Product Recommendations, Mutual Fund Look-Through & Overlap Radar (Issue #20)
✅ **Look-Through & Fund Overlap Radar (`portfolioMath.js` + `PortfolioRebalancerModal.jsx`)**:
  - Analyzes mutual fund and equity holdings to detect inter-scheme duplication (e.g. Flexi Cap + Nifty 50 overlap sharing identical heavyweights: HDFC Bank, ICICI Bank, Reliance, Infosys).
  - True Sector Allocation heatmap: Audits effective exposure to Financials, IT, Auto, FMCG, Healthcare, and Cash to alert on hidden sectoral skews.
  - Market Cap Exposure gauge: Accurately maps effective portfolio split across Large Cap (68%), Mid Cap (22%), and Small Cap (10%).
✅ **Tax & Yield Arbitrage Switch**:
  - Automatically identifies high-tax-bracket inefficiencies (e.g., Bank FDs taxed at ~31.2% slab rates).
  - Recommends shifting idle liquid surplus into Arbitrage Funds (benefiting from Section 112A equity capital gains treatment: 12.5% LTCG / 20% STCG with ₹1.25L exemption), unlocking an extra ~+1.5% net annual post-tax yield (~₹14,200/yr savings).
✅ **Curated Zero-Commission Direct Product Matcher**:
  - Suggests specific, low-cost Direct Mutual Funds (e.g., UTI/ICICI Nifty Next 50 Direct Index, 0.22% TER, 0.04% tracking error), Sovereign Gold Bonds (SGB 2031-32 secondary market at ~3.1% discount to spot, 100% tax-free capital gains), and Arbitrage Funds.
  - Category filter chips, stats grid (TER, tracking error, 3Y CAGR), rationale, and a "Deploy Direct" guide for MF Central / direct brokers.
✅ **Backend Intelligence Gateway (`Code.gs`)**:
  - `generateProductIntelligence`: Anonymized holdings payload, Gemini 1.5 Flash structured JSON response, and deterministic offline engine fallback.
  - Compliance: SEBI RIA regulatory disclaimer stating algorithmic research and educational portfolio analytics.

## Feature Update (v2.8) - AI Portfolio Rebalancer & Asset Allocation Advisor (Issue #18)
✅ **Deterministic Financial Math Engine (`portfolioMath.js`)**:
  - Implements multi-asset drift calculation, absolute portfolio drift sum, and 0-100 Alignment Score formula.
  - Smart Fresh Capital Inflow Simulator ("No-Sale Rebalancing"): Given new money $\Delta C$, mathematically allocates strictly to underweight categories proportionally to their shortfalls, minimizing drift without selling any asset (avoiding Section 112A LTCG / Section 111A STCG tax).
  - Cash drag & runway intelligence: Analyzes liquid bank deposits against 6 months of actual living expenses to quantify deployable idle funds.
  - Concentration risk monitor: Flags single assets representing $>15\%$ of total portfolio or $>20\%$ of listed equities.
✅ **Backend Hybrid AI Gateway (`Code.gs`)**:
  - `generatePortfolioInsights`: Privacy-sanitized payload stripping personal identifiers (accounts, folios, names).
  - Google Gemini 1.5 Flash (Free Tier) integration via native Apps Script `UrlFetchApp`.
  - Offline Heuristics Engine fallback: Provides rich, SEBI-compliant financial advisory insights even when no API key is provided or when offline.
✅ **Interactive UI / UX (`PortfolioRebalancerModal.jsx`)**:
  - High-fidelity OLED Dark mode design matching the Stitch prototype (`screen_12_ai_portfolio_rebalance.html`).
  - Stacked progress bars showing Current vs Target Benchmark vs Projected Post-Inflow.
  - Interactive simulation chips (`₹25k`, `₹50k`, `₹1,00,000`, `₹2,50,000`), custom amount input, and real-time slider.
  - Risk profile presets (*Moderate*, *Aggressive*, *Conservative*, *All-Weather*, *Custom*) and in-app target percentage customizer.
  - Integrated directly into `HomeTab`, `AssetsTab`, and `SettingsTab` with hardware back navigation support.

## Feature Update (v2.7) - Container-Aware Dual-Tier Security Architecture (Issue #14)
✅ **Container-Aware Platform Detection**: Automatically detects runtime container (Mobile App Shell via `NetWorthManagerApp/2.0` user-agent and `window.ReactNativeWebView` vs Web Browser) and dynamically tailors security controls.
✅ **Mobile PIN App Lock (`AppLockScreen`)**:
  - Standalone high-security gatekeeper with 4-digit masked dots indicator, responsive numeric keypad, and hardware keyboard support (`0-9`, `Backspace`, `Escape`).
  - Cryptographic salted hashing: PIN is hashed using `window.crypto.subtle` SHA-256 (`Hash = SHA-256(DeviceSalt || PIN)`) and never stored in plaintext.
  - Brute-force rate limiting: Progressive 30-second security cooldown lockout after 5 consecutive failed attempts.
  - Smart lifecycle auto-lock & grace periods: Configurable re-authentication interval (Immediately, 1 min, 5 min, 15 min) on cold start and background-to-foreground transitions (`visibilitychange`, `blur`/`focus`).
  - "Forgot PIN? Sign In with OTP" fallback trigger that safely purges stored PIN credentials and routes the user to email OTP re-authentication.
  - Fresh mobile login PIN prompt: Automatically prompts user to set a PIN upon completing OTP verification in the mobile shell.
✅ **Background & App Switcher Privacy Curtain (`PrivacyCurtain`)**:
  - Secure privacy shield overlay conceals sensitive net worth and account numbers whenever the app loses focus or is backgrounded in the OS multitasking carousel.
✅ **Web Browser Ephemeral Session & Inactivity Protection**:
  - Dynamic storage routing: Sensitive session tokens default to tab-scoped `sessionStorage` in browsers (purged on tab/window close) with an optional "Keep me signed in on this computer" preference for trusted desktop environments.
  - Inactivity idle timer: Monitors user interactions and automatically locks the session after inactivity (default 15 minutes).
✅ **Security Configuration Center (`SecurityModal`)**:
  - Accessible via the Shield icon in the expandable app header and a dedicated section in `SettingsTab`.
  - Comprehensive controls for PIN management, Set/Change PIN wizard with current PIN verification, Auto-lock grace period picker, browser persistent login toggle, inactivity timeout, and single-click device sign-out.
## Feature Update (v2.6) - Historical Valuations, Auto-Cost Suggestion, CAGR & Tax Intelligence (Issue #10)
✅ **Historical Acquisition Pricing Engine**: Integrated historical valuation retrieval on a given acquisition date:
  - **Mutual Funds**: Exact historical daily NAV lookup from the official AMFI time-series (`https://api.mfapi.in/mf/{schemeCode}`).
  - **Gold**: Historical rate via Google Sheets `=GOOGLEFINANCE("CURRENCY:XAUINR", "price", ...)` converted per gram for 24K, 22K, and 18K purity with weekend/holiday rollback and multi-decade fallback benchmarks.
  - **Equities / ETFs**: Historical closing price via Google Finance historical pricing formula.
✅ **Auto-Cost Suggestion & Application**: As soon as the user enters or changes the acquisition date and units/weight, the UI displays the historical rate and offers a one-tap "Apply Cost" action (and automatically populates empty cost) to calculate total invested amount and average purchase price/NAV.
✅ **Annualized Return / CAGR Engine**: Computes Compound Annual Growth Rate (`CAGR = (Current Value / Cost)^(1 / Years) - 1`) for all holdings $\ge 6$ months.
✅ **Indian Capital Gains Tax Intelligence**: Categorizes holdings into Long Term Capital Gain (`LTCG`) vs Short Term Capital Gain (`STCG`) based on Indian Income Tax holding rules:
  - Equities & Mutual Funds: LTCG if held $> 12$ months (12.5% above ₹1.25L), STCG if $\le 12$ months (20%).
  - Gold, Real Estate & Other Assets: LTCG if held $> 24$ months (12.5%), STCG if $\le 24$ months (slab rates).
✅ **Asset Card Badges & In-Form Analytics**: Displays holding period (e.g. `2.4y`), CAGR badge (`+18.4% p.a.`), and tax status tags (`LTCG`/`STCG`) on both the asset cards in `AssetsTab` and inside `DynamicForm`.

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
