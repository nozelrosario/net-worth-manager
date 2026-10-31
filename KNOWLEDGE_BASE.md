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

## Feature Update (v3.7) - Automated CAS Investment Ingestion via CAMS+KFintech PDF, Google Drive & Gemini AI (Issue #58)
✅ **Single Golden Path Ingestion Pipeline (`casParser.js` & `Drive.gs`)**:
  - **CAMS + KFintech Statement Support**: Ingests the standard unified Consolidated Account Statement (CAS) PDF covering 100% of Indian mutual funds across all AMCs.
  - **Google Drive Auto-Scanner**: `scanDriveForCas(folderName, idToken)` scans the configured Drive folder (`Net Worth Manager/CAS Imports`), locates the newest `.pdf`, and returns metadata + binary-safe Base64 payload.
  - **Zero-Knowledge In-Memory Decryption**: Dynamically loads PDF.js from Cloudflare CDN upon modal mount (preventing bundle bloat in `vite-plugin-singlefile`) and decrypts the password-protected statement in-memory using the user's PAN or custom CAMS password. Includes main-thread preloading of `pdf.worker.min.js` to eliminate cross-origin sandbox restrictions in Apps Script iframes, a 15-second decryption timeout guard, and case-preserved password handling with an inline uppercase PAN toggle.
  - **2D Geometry Sorting & Continuous Baseline Line Reconstruction**: Sorts text items top-to-bottom (descending Y) and left-to-right (ascending X) using continuous baseline tolerance (`yDiff <= 3.5px`). Reconstructs table rows coherently without premature stream splits, enabling aggressive regex-based historical transaction pruning (`isHistoricalTransactionRow`). This prunes verbose SIP, switch, redemption, and stamp-duty rows while strictly preserving scheme names, folios, ISINs, closing balances, NAVs, and total valuations—reducing prompt size by 80–95% (from 100K+ chars to ~3K chars).
  - **Multi-Tier Gemini AI Engine & Apps Script Backend Cascade (`executeGeminiPromptBackend`)**:
    - *Tier 1 (Primary)*: `gemini-3.5-flash-lite:generateContent` with minimal thinking and 1,500 RPD free tier quota for instantaneous (1–2s) structured JSON portfolio extraction.
    - *Tier 2 (Fallback)*: `gemini-3.8-flash:generateContent` with `thinkingConfig: { thinkingLevel: 'low' }` to eliminate reasoning latency and avoid timeouts.
    - *Tier 3 (Alternative)*: `gemini-3.8-flash:generateContent` on `v1` endpoint.
    - *Tier 4 (Agentic)*: `gemini-3.8-flash` on the Interactions API (`/v1beta/interactions`) with `thinking_level: 'low'`.
    - *Bypass CORS*: Cloud execution via Google Apps Script `UrlFetchApp` eliminates browser CORS restrictions inside sandboxed iframes. Direct client-side fetch is retained as a preview environment fallback.
✅ **Units-First Snapshot Reconciliation Engine (`reconcileCasWithLedger`)**:
  - **Live Valuation Priority**: Updates `Units` and `Cost` from CAS while computing real-time net worth: $\text{Current Value} = \text{Units} \times (\text{Live AMFI Quote} \lor \text{Statement NAV})$, preventing stale statement dates from downgrading live portfolio values.
  - **Composite Key Matching**: Matches holdings by $\mathbf{Composite\ Key} = \text{Folio Number} + (\text{ISIN} \lor \text{Normalized Scheme Name})$, preventing multi-folio scheme collisions.
  - **Family Profile Auto-Assignment**: Fuzzy-matches `statement_holder_name` against the `FamilyProfiles` sheet (`Nozel`, `Maria`) to pre-select asset ownership automatically.
  - **Metadata Preservation**: User-assigned Owner, Nominees, notes, and linked Family Safe documents are strictly preserved.
✅ **Interactive Review Modal & In-App Guide (`CasSyncModal.jsx` & Screen 18 Prototype)**:
  - High-fidelity OLED Dark (`#0B0F17`) and Clean Light mode interface matching Stitch design tokens with borderless glow badges.
  - Hero reconciliation summary card with wrapped valuation numbers (`break-words`) and integrated into the scrollable body flow (preventing header overlap).
  - Metric summary ribbon tracking total statement valuation, valuation delta vs existing ledger, net SIP inflow, and updated/new counts.
  - Holding cards with `line-clamp-2` and `break-words` on scheme names to ensure long titles wrap neatly without overflowing.
  - Fixed background bleed-through using CSS variable tokens (`bg-background-root`).
  - Sticky bottom commit dock with `pb-32` clearance to prevent clipping of the final holding card.
  - Filter tabs (`All`, `Updated / SIP`, `New Detected`, `Redeemed / Zero`, `Unchanged`).
  - Embedded "How to Export CAS from CAMS" guide modal with direct link to CAMS Online and password rules.
  - In-place password retry recovery on `PasswordException` without resetting scanned file state.
✅ **Single-Flush Database Batch Sync (`batchSyncCasAssets` in `Drive.gs`)**:
  - Commits all asset updates, new row appends, and watermark settings in a single spreadsheet flush, reducing sync time from ~10s to <1s.
  - Automatically registers new schemes in `MarketQuotes` for continuous live AMFI NAV tracking.
  - Fully integrated into `AssetsTab.jsx` ("Sync CAS" quick-action pills) and `SettingsTab.jsx` (Drive folder and PAN configuration).


## Feature Update (v3.6) - SMS Inbox Free-Text Search & Alike Batch Ingestion (Issue #55)
✅ **Free-Text Search Engine (`smsParser.js` & `SmsInboxModal.jsx`)**:
  - Implemented multi-token case-insensitive free-text search matching across merchant/payee, raw SMS body text, preview snippet, bank name, asset account, account digits, reference/UPI IDs, category, transaction type, beneficiary, sender address, date, and currency amounts.
  - Fast space-separated multi-keyword AND matching allowing queries like `"hdfc 450"` or `"zomato online"`.
  - Responsive search bar with instant clear action (`X` button & `Escape` key) and live match counter pill.
✅ **Seamless Batch Selection & Ingestion**:
  - Filter-aware "Select All" checkbox correctly scoped to currently matching filtered records (`Select All (X/Y)`), preventing confusion when searching and staging alike records.
  - Allows users to isolate and select alike message entries together for bulk classification and batch import into the ledger.
  - Dedicated contextual empty state when search yields zero matches, with a 1-tap "Clear Search Filter" button.

## Bug Fix Update - Spends Modal Delete & Save Button State Decoupling (Issue #41)
✅ **Independent Submission States (`SpendsTab.jsx`)**:
  - Decoupled single `isSubmitting` boolean state into separate `isSaving` and `isDeleting` states.
  - Resolved erroneous button labeling where the Delete button changed to `"Deleting..."` while saving a transaction.
  - Ensured both action buttons and the Cancel button remain properly disabled during active in-flight requests (`isSaving || isDeleting`) while displaying accurate contextual action labels.

## Feature Update (v3.5) - Multi-Member Spend Tagging & Equal Split Analytics (Issue #42)
✅ **Multi-Member Beneficiary Tagging**:
  - Interactive multi-select pill interface in Spends Tab (`SpendsTab.jsx`) replacing single `<select>` dropdown.
  - Multi-member chip toggle selector in SMS Review Ingest card details (`SmsInboxModal.jsx`).
  - Backward-compatible comma-separated storage (`"Nozel, Maria"`) in Google Sheets `Beneficiary` column with zero schema changes required.
  - Automatic fallback to `"Whole Family"` when all members or no members are selected.
✅ **Equal-Split Analytics Math (`breakdownData`)**:
  - Spending amounts split equally across all tagged members ($A / N$), ensuring $\sum \text{Split} \equiv \text{Total Spend}$ without inflating or deflating totals.
✅ **Multi-Beneficiary Filter Matching (`filteredTxns`)**:
  - Filtering by individual family member matches both single-beneficiary and multi-tagged transactions where the member is included.
  - "Whole Family" filter correctly isolates household-wide unassigned spends.

## Feature Update (v3.3) - Comprehensive Insurance & Policy Hub (Issue #33)
✅ **Dedicated Insurance Financial Math Engine (`insuranceMath.js`)**:
  - **Balance Sheet vs Cashflow Separation**: Distinct handling of investment-backed policies (LIC endowment, money back, ULIPs) vs pure defensive shields (Term Life, Health, Motor).
  - **Human Life Value (HLV) Defense Auditor**: Models recommended life cover: $(15 \times \text{Annual Living Expenses}) + \text{Total Liabilities} - \text{Liquid Assets}$, computing coverage score (0-100%) and underinsurance deficit.
  - **Accretion & Surrender Valuation**: Accurately tracks cumulative premiums paid (`Cost`) vs realizable surrender value (`Current Value`) with net accretion calculations.
  - **Tax Sub-Ledger & Budget 2023 Watchdog**: Audits Section 80C (Life, up to ₹1.5L) and Section 80D (Health, ₹25k/₹50k), and flags policies with annual premiums $> ₹5,00,000$ losing Section 10(10D) tax exemption.
✅ **Granular Dynamic Schema (`assetSchemas.js` & `DynamicForm.jsx`)**:
  - First-class `Life Insurance / LIC` asset schema with fields for Policy Type, Policy Number, Insurer, Servicing Branch, Sum Assured, Health Sum Insured, Policy Term, Premium Paying Term (PPT), Premium Amount, Frequency, Next Due Date, Grace Period Days, Maturity Date, Estimated Maturity Corpus, and Nominee.
  - Auto-categorization of tax status as `Sec 10(10D)` in DynamicForm.
✅ **Interactive UI / UX (`InsuranceHubModal.jsx`, `AssetsTab.jsx` & `HomeTab.jsx`)**:
  - High-fidelity OLED Dark & Clean Light mode modal matching prototype (`screen_16_insurance_protection_hub.html`).
  - Triad metric hero card (Total Life Cover, Health Cover, Annual Premium Drag, and HLV Defense Score).
  - Renewal Watchdog & Grace Period Alert banner with 1-tap "Log Premium" double-entry action dialog (adds spend transaction and increments asset cost base).
  - Active policy cards with Premium Paying Term (PPT) completion progress bars, next due date countdown badges, and nominee details.
  - Dedicated "Insurance Hub" CTA pills on HomeTab, AssetsTab, and SettingsTab.
  - Grace Period & Due Date monitoring integrated directly into `App.jsx` bell notification modal.
  - Enhanced SMS parser for instant detection of LIC, HDFC Life, ICICI Pru, Max Life, Star Health, and HDFC ERGO debits.

## Feature Update (v3.2) - Automated SMS Expense & Transfer Ingestion (Issue #29)
✅ **SMS Backup & Restore Incremental Sync Engine (`smsParser.js` & `Drive.gs`)**:
  - **Dual Ingestion Pipeline**: Ingests automated incremental XML backups from Google Drive (`DriveApp`) and provides a client-side streaming drag-and-drop XML file uploader.
  - **4-Tier Deduplication & Paired Suppression**:
    1. *Database & Deterministic Ledger Reconciliation*: Cross-reconciles incoming candidate entries against existing ledger rows via deterministic SMS fingerprints and (Date, Amount, Account) indexing, ensuring unimported entries remain actionable while previously imported records are accurately recognized.
    2. *Compound Fingerprint & UTR Registry*: Generates unique hashes per SMS and indexes bank reference numbers (`Refno`, `RRN`, `Txn ID`).
    3. *Paired Merchant-Bank Suppression*: Suppresses duplicate vendor notifications (e.g. Jio/Airtel receipts paired with bank debits within a 3-minute window).
    4. *Duplicate Suppression*: Prevents duplicate candidates within the same backup file.
  - **Smart Entity Extraction & Auto-Classification**:
    - **Internal Transfer Detection**: Recognizes transfers to user's self/own accounts (`GRAMINA NOZEL RO`, `NOZEL ROSARIO`, `SELF`, `OWN A/C`) and automatically sets `Is Transfer: true` with zero net cashflow drag.
    - **Investment & Insurance**: Identifies SIPs, mutual funds, and LIC/Kotak life insurance debits, tagging Section 80C tax incentives.
    - **Spend / Expense**: Automatically extracts payee, clean merchant names, bank accounts (`SBI ••4089`, `HDFC CC ••3601`, `StanChart ••4469`), and assigns contextual categories.
✅ **Interactive Review Inbox Modal (`SmsInboxModal.jsx`)**:
  - Responsive modal with Apple Wallet/Raycast style borderless glow badges (`Badge.jsx`) for both Dark OLED (`#0B0F17`) and Crisp Light Mode (`#F8FAFC`).
  - Metric summary ribbon tracking pending spends, transfers, investments, and blocked duplicates.
  - Multi-select batch actions (`Select All`, `Import Selected`, `Dismiss`).
  - Card-level inline classification toggle (`[Spend | Internal Transfer | Investment]`), category selector (dynamically synchronized with Admin `SpendCategories` including canonical `General Expense`), asset picker, and expandable raw SMS text drawer.
  - Keeps inbox modal open after importing so users can seamlessly continue reviewing and importing more entries without disruptive auto-navigation back to SpendsTab.
  - Seamlessly integrated into `SpendsTab` (with "SMS Inbox" CTA) and `SettingsTab` (Drive folder & watermark management).

## Feature Update (v3.1) - Borderless Glow Badge System & Layout Decoupling (Issue #26)
✅ **Unified Badge Component (`Badge.jsx`)**:
  - Implemented Apple Wallet & Raycast-inspired borderless glow micro-pills (`rounded-full`) across all screens.
  - Eliminated harsh semi-opaque/white borders (`border-white/[0.08]`, `border-wealth-emerald/20`) on dark OLED backgrounds, switching to subtle translucent background luminance (`bg-emerald-500/12 text-emerald-400`).
  - Added semantic micro-dots (`w-1.5 h-1.5`) with glow shadows (`shadow-[0_0_6px_rgba(...)]`) and pulse animation support for live rate status.
  - Standardized semantic variants (`emerald`, `amber`, `rose`, `indigo`, `sky`, `neutral`) and constrained sizes (`xs: text-[9px]`, `sm: text-[10px]`, `md: text-xs`) with `whitespace-nowrap` truncation protection.
✅ **Card Header Layout Decoupling**:
  - Refactored `HomeTab` cards (`Retirement & Pension Hub`, `AI Portfolio Advisor & Rebalance`) to decouple badge tags from inline `<h3>` headers.
  - Resolved mobile layout crowding and title wrapping on narrow viewports (<390px).
  - Streamlined copy across cards (e.g. `8.25% EPF / NPS`, `Zero Tax`, `EEE Tax-Shielded`).

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
