# PROJECT SPECIFICATION: "Net Worth Manager" (Family Office, Multi-Asset Net Worth & Emergency Succession Safe)
# Features 
1. Automated Cashflow & Expense Ingestion
Automates daily expense detection and categorization directly from financial alerts without manual bookkeeping friction.
 * On-Device SMS Parser: Automatically listens to incoming bank and UPI SMS messages directly on the device using regex templates designed for Indian banking sender IDs. It extracts key transaction fields: debited/credited amount, timestamp, merchant name or UPI VPA, bank identifier, account/card last 4 digits, and reference/UTR number.
 * Transfer & Self-Payment Auto-Detection: Intelligently identifies internal movements of funds (e.g., paying a credit card bill from savings, transferring funds to a Demat/trading account, or moving cash between self accounts) to avoid double-counting them as expenses.
 * Smart Noise & Spam Filter: Discards non-transactional messages, such as OTPs, marketing alerts, promotional spam, and generic bank balance notifications.
 * Category Tagging & Review Queue: Automatically maps recognized merchants to standard expense buckets (e.g., groceries, dining, utilities) while routing ambiguous or new transactions into an inbox queue for quick one-tap verification.
 * Manual Cash Spend Ledger: Provides a fast-entry modal to record out-of-pocket physical cash spends that do not generate bank SMS alerts.
 * Split Transaction Support: Allows users to split a single parsed debit into multiple categories (e.g., dividing a large supermarket UPI payment into groceries and household hardware).
2. Multi-Entity Family Office Structure
Enables managing wealth across multiple family members while preserving individual and collective financial views.
 * Family Entity Profiles: Dedicated sub-profiles to manage assets and liabilities for Self, Spouse, Parents, and Minors.
 * Granular Ownership Models: Supports 100% sole ownership, joint holding structures with custom ownership percentage splits (e.g., 50–50 or 70–30 co-owned real estate), and guardian-managed accounts for minor dependents.
 * Consolidated vs. Filtered Views: Offers a one-tap toggle between the total combined family net worth balance sheet and single-member views.
 * Member Account Mapping: Automatically attributes parsed SMS debits and credits to the correct family member by linking the detected account or card last 4 digits to their individual profile.
3. Multi-Asset Wealth Aggregator & Detailed Entry Screens
Provides specialized, modular entry screens and automated calculations across liquid, market-linked, physical, and illiquid holdings.
 * Market-Linked Investments (Equities & Mutual Funds):
   * Automatically fetches daily closing Net Asset Values (NAVs) via AMFI scheme codes (MFAPI) and daily closing stock prices for listed equities.
   * Features a lot-level purchase repeater (Buy Date, Units, Buy NAV/Price, Outflow) supporting FIFO cost-basis tracking for Section 111A (STCG) and Section 112A (LTCG) tax calculations.
   * Tracks Demat DP IDs, broker names, folio numbers, and AMC nominee records.
 * Physical Precious Metals (Gold & Silver):
   * Logs physical gold and silver by type (coins, bars, jewelry), purity (24K, 22K, 18K), and weight in grams.
   * Multiplies purity-adjusted grams against live daily bullion spot rates to show real-time valuation, with an option for manual valuation.
   * Records purchase invoices, making charges, and physical storage locations (e.g., home safe, bank locker).
 * Fixed Deposits (FD) & Recurring Deposits (RD):
   * Tracks principal amounts, interest rates, tenure, maturity dates, and payout mechanics (cumulative/reinvestment vs. periodic payouts).
   * Dedicated input fields record annual accrued interest (YTD) and TDS deducted by the bank for seamless reconciliation with Form 26AS/AIS.
   * Logs FDR/certificate numbers, auto-renewal flags, and physical deposit receipt locations.
 * Real Estate & Illiquid Land:
   * Captures property type, address, baseline acquisition cost, acquisition date, and an annual compounding appreciation model (A = P(1+r)^t) to project fair market value.
   * Captures critical legal identifiers: Survey number, Khata, Patta, and Khasra numbers.
   * Records physical deed storage locations, registered nominees, and PDF deed attachments, as well as stamp duty and home improvement costs for capital gains records.
 * Retirement Schemes & Liabilities:
   * Tracks balances and contributions for EPF, PPF, NPS, and Sukanya Samriddhi Yojana (SSY).
   * Directly offsets total assets with liabilities, including credit card outstanding balances, home loans, vehicle loans, and personal loans.
4. Advanced Portfolio Analytics & Allocation
Provides high-level intelligence on asset distribution, cash drag, and risk exposure.
 * Cash Drag vs. Inflation Monitor: Displays the percentage of total family net worth sitting idle in low-interest savings accounts compared against inflation-hedging, growth assets.
 * Asset Class Rebalancing Visualizer: Compares actual portfolio weightings (Equities vs. Debt/FD vs. Gold vs. Real Estate) against target allocation benchmarks (e.g., 60/20/10/10) to highlight portfolio drift.
 * Concentration Risk Monitor: Flags portfolio vulnerabilities when an individual stock holding or specific sector weighting exceeds safety thresholds.
 * Sovereign Gold Bond (SGB) Tracker: Tracks SGB tranches independently from physical bullion, projecting semi-annual 2.5% coupon payouts and monitoring maturity dates for tax-exempt capital redemption.
5. Proactive Event, Maturity & Renewal Reminders
Prevents financial loss, lapse penalties, and lock-ins through a scheduled, staggered notification system.
 * FD & RD Maturity Alerts: Fires notifications prior to deposit maturity dates (e.g., 30 days, 7 days, 1 day prior) detailing the payout amount and linked destination bank account to evaluate reinvestment options.
 * Insurance Premium Renewals: Staggered alerts for Term Life, Health Floater, Vehicle, and Home policies with premium sums, grace period deadlines, and policyholder names to prevent coverage lapse.
 * Physical Locker & Administrative Renewals: Tracks annual bank locker rent due dates, tenant lease agreement renewal/escalation reviews, and recurring bank/Demat re-KYC deadlines.
 * Credit Card Statement & Due Alerts: Alerts users ahead of credit card payment due dates using parsed statement records to prevent late fees and finance charges.
 * Unified Financial Calendar: Consolidates all upcoming cash outflows—including FD maturities, SIP auto-debits, premium payments, and loan EMIs—into a single chronological monthly view.
6. Emergency Dossier & Succession Ledger (Family Safe)
Ensures full continuity and administrative access for trusted family members or executors during an emergency.
 * Central Administrative Registry: Master reference of all Demat DP IDs, mutual fund folios, bank account numbers, IFSC codes, and customer IDs.
 * Physical Asset & Key Locator: Clear directory detailing bank locker numbers, locker branch addresses, co-signatory rules, locker key locations, and physical deed/will hiding spots.
 * Insurance Claim Center: Consolidated directory of policy numbers, sums assured, network hospital details, Third-Party Administrator (TPA) names, and 24x7 cashless claim helpline contacts.
 * Nomination Audit Matrix: A compliance dashboard and risk score that flags any bank account, mutual fund folio, or deposit lacking an up-to-date registered nominee or percentage allocation.
 * Encrypted Emergency Dossier (ICE Kit) Export: Generates a secure, password-protected master PDF containing all asset locations, folios, insurance policies, and claim instructions for family members or legal executors without requiring everyday app access.
7. Privacy, Access & Everyday Usability
Maintains security and daily practical convenience in both private and shared environments.
 * Privacy & Screen Masking Mode: A one-tap toggle on the home screen that instantly masks sensitive monetary balances (₹ ****) across cards and balance sheets, allowing safe usage in public settings.
 * Role-Based Family Access / Read-Only Companion: Enables sharing a stripped-down, read-only dashboard or export for a spouse or older child that reveals emergency policies, bank account directories, and locker locations while keeping day-to-day spending and detailed valuations hidden.


## 1. GLOBAL DESIGN SYSTEM & TOKENS (Apply Across All Screens)
- App Name Branding: "Net Worth Manager"
- Target: Mobile Native (393px × 852px base viewport, high-density OLED display)
- Color Palette:
  * Background Root: Dark Slate `#0B0F17`
  * Surface / Cards Layer 1: `#151C28`
  * Surface / Cards Layer 2 (Elevated): `#1E293B`
  * Borders & Dividers: 1px solid `#222F3E` or `#334155`
  * Primary Accent: Deep Indigo / Violet `#6366F1` (Active states, primary CTAs)
  * Wealth / Profit Accent: Vibrant Emerald `#10B981` (Gains, positive cashflow, verified state)
  * Bullion / Warning Accent: Amber Gold `#F59E0B` (Gold spot feeds, nomination missing alert)
  * Liability / Outflow Accent: Crimson Rose `#F43F5E` (Debts, expense debits, critical missing data)
  * Text Hierarchy: Primary `#F8FAFC`, Secondary `#94A3B8`, Muted/Tertiary `#64748B`
- Typography: SF Pro / Inter font family. Strict tabular lining numbers (`font-variant-numeric: tabular-nums`) for currency values and dates.
- Number Formatting: Strictly Indian numbering standard (e.g., ₹4,82,45,000 / ₹18.50 L / ₹64,200).
- Privacy Masking Global Rule: When active, every sensitive balance replaces numbers with "₹ ••••••".

---

## 2. EXHAUSTIVE SCREEN SPECIFICATIONS

### SCREEN 01: Biometric Gateway & App Launch
- Screen Goal: Zero-knowledge local entry and session initialization.
- Layout:
  * Status Bar: Native dark status icons, 11:35 AM IST time, battery & 5G indicators.
  * Header/Center Branding: Centered Shield Emblem with a geometric dual-key motif (indigo/emerald gradient). Large typography "Net Worth Manager", subtitle "Private Family Office & Succession Ledger".
  * Authentication Area:
    - Biometric fingerprint/FaceID pulse sensor graphic in `#6366F1`.
    - Text: "Unlock Net Worth Manager".
    - Passcode Fallback: Six subtle circular dot inputs for master PIN.
    - Footer Action: Text button "Use Offline Master Recovery Passphrase".
  * Privacy Watermark: "Local-First • On-Device Encrypted • Zero Cloud Sync" with a closed lock icon.

---

### SCREEN 02: Master Family Office Dashboard (Tab 1: Home)
- Screen Goal: Consolidated family financial cockpit, allocation drift, runway metrics, and action inbox.
- Layout:
  * Sticky App Bar:
    - Left: Profile Avatar with badge initials + interactive dropdown picker: "[ All Family (Combined) ▾ ]" (options: All Family, Self, Spouse, Parents, Minors).
    - Center/Title: "Net Worth Manager" (Clean, authoritative typography).
    - Right Icons: Privacy Masking Eye icon (toggles between visible numbers and `••••`), and Notification Bell with an Amber Badge count (3).
  * Consolidated Hero Card (Elevated Surface `#151C28` with subtle border):
    - Label: "CONSOLIDATED FAMILY NET WORTH" (11px uppercase tracking).
    - Big Hero Balance: "₹4,82,45,000" (32pt bold tabular numerals).
    - Trend Indicator: "+₹1,24,000 (+2.6%) this month" in a soft emerald pill badge.
    - Quick Horizontal Asset Split Ribbon:
      * Segmented progress bar: 40% Equities (Indigo), 35% Real Estate (Teal), 15% Bullion (Gold), 10% Cash/FD (Emerald).
      * Legend chips below: "Equity: ₹1.92 Cr" • "Property: ₹1.70 Cr" • "Gold: ₹72.4L" • "Cash/FD: ₹47.5L".
  * Analytics & Runway Widgets (2-Column Grid):
    - Left Card: "Liquid Buffer & Drag" -> Value: "₹18.50 L" -> Subtitle: "14.2 Mos Runway" -> Footer Pill: "⚠️ 4.2% Cash Drag vs Inflation".
    - Right Card: "Sep 2026 Cashflow" -> Value: "-₹64,200 Spent" -> Subtitle: "Inflow: ₹2,10,000" -> Footer Pill: "69.4% Savings Rate".
  * Priority Action Required Carousel (Horizontal swipe cards):
    - Card 1 (Red Warning): Shield alert icon | "Nomination Missing: Dad's SBI FD #9402" | CTA Button: "[ Fix Nominee ]".
    - Card 2 (Amber Alert): Receipt icon | "3 SMS Transactions Need Review" | Swiggy ₹1,450, BESCOM ₹2,340 | CTA Button: "[ Review ]".
    - Card 3 (Blue Info): Calendar icon | "Health Floater Premium Due in 7 Days" | HDFC Ergo ₹28,400 | CTA Button: "[ Pay & Log ]".
  * Asset Class Breakdown Accordion List:
    - Item 1: Market Investments (Equities, MFs) | 14 Schemes | ₹1,92,50,000 | +1.4% today (Live AMFI sync).
    - Item 2: Physical Bullion | 500g 24K Coins, 420g 22K Jewelry | ₹72,40,000 (Live spot rate).
    - Item 3: Real Estate & Land | 3 Properties (Ancestral plot, flat) | ₹1,70,000,000.
    - Item 4: Fixed Income & Bank Deposits | 3 FDs, 4 Savings Accounts | ₹47,55,000.
    - Item 5: Liabilities & Debt | HDFC Home Loan, 2 Credit Cards | -₹40,00,000 (Crimson red font).
  * Global Bottom Navigation (4 Tabs):
    - Tab 1: Dashboard (Active, Indigo icon)
    - Tab 2: Portfolio & Assets
    - Tab 3: Spends & SMS Cashflow
    - Tab 4: Family Safe (ICE Shield icon with health badge)

---

### SCREEN 03: Multi-Asset Portfolio Hub (Tab 2: Assets)
- Screen Goal: Deep portfolio breakdown with live price sync status and entity ownership tags.
- Layout:
  * Top Bar: Title "Assets & Liabilities", right button `[+ Add Asset]`.
  * Sync Status Ribbon: "Last Market Sync: Today, 9:00 PM IST (AMFI NAVs & Bullion Live)" with a manual refresh spin icon.
  * Filter Chips (Horizontal Scroll): `[ All Assets ]`, `[ Market-Linked ]`, `[ Precious Metals ]`, `[ Real Estate ]`, `[ Fixed Deposits ]`, `[ Liabilities ]`.
  * Section A: Market-Linked Assets:
    - Holding Card 1: "Parag Parikh Flexi Cap Fund - Direct Growth" | Folio: 10482910 | Units: 1,840.12 | Current NAV: ₹84.21 | Current Value: ₹1,54,956 | Returns: +18.4% XIRR | Owner Tag: "Self (100%)".
    - Holding Card 2: "Reliance Industries Ltd (RELIANCE)" | Demat: Zerodha 12081600 | Qty: 150 | Avg Buy: ₹2,420 | CMP: ₹2,980 | Current Value: ₹4,47,000 | Owner Tag: "Spouse (100%)".
  * Section B: Physical Bullion:
    - Holding Card 3: "24K Minted Gold Bars & MMTC Coins" | Weight: 500.00 grams | Purity: 24K (99.9%) | Current Spot: ₹7,240/g | Value: ₹36,20,000 | Storage Tag: "Home Godrej Safe Locker #2".
    - Holding Card 4: "Family Bridal Gold Set" | Weight: 420.00 grams | Purity: 22K (91.6%) | Value: ₹27,87,120 | Storage Tag: "Bank of Baroda Locker #42".
  * Section C: Real Estate & Ancestral Land:
    - Holding Card 5: "Ancestral Agricultural Land, Wardha" | 4.5 Acres | Khata #412/9B | Base Cost: ₹8,50,000 | Compounded Value (6% p.a.): ₹45,00,000 | Ownership Tag: "Father (100%)" | Nominee: "Self & Spouse (50/50)".
    - Holding Card 6: "3BHK Apartment, Bangalore" | Acquisition: ₹95,00,000 | Current Fair Value: ₹1,25,00,000 | Ownership Tag: "Joint: Self (50%) / Spouse (50%)".
  * Section D: Fixed Income & Liquid Cash:
    - Holding Card 7: "SBI Cumulative Term Deposit" | Principal: ₹15,00,000 | Rate: 7.10% | Maturity: 14-Aug-2027 | Accrued Interest (YTD): ₹84,200 | TDS Deducted: ₹8,420 | Missing Nominee Badge: "⚠️ No Nominee".
  * Section E: Liabilities:
    - Card 8: "HDFC Home Loan #601928" | Outstanding Principal: -₹38,40,000 | EMI: ₹42,500/mo | Ownership: "Joint".

---

### SCREEN 04: Advanced Portfolio Analytics & Allocation Visualizer
- Screen Goal: Institutional-grade asset allocation rebalancing, cash drag analysis, and concentration risk.
- Layout:
  * Top Bar: Back button, Title "Portfolio Analytics", Tab toggle: `[ Allocation ]` | `[ Concentration ]` | `[ SGB Tracker ]`.
  * Section 1: Target vs. Actual Rebalancing Visualizer:
    - Dual comparison bar or Donut Chart showing Drift:
      * Equities: Actual 40% vs. Target 50% (-10% Drift -> Underweight)
      * Real Estate: Actual 35% vs. Target 25% (+10% Drift -> Overweight)
      * Physical Gold: Actual 15% vs. Target 15% (Balanced)
      * Debt/FD/Cash: Actual 10% vs. Target 10% (Balanced)
    - Rebalancing Action Prompt: "Recommendation: Direct upcoming SIPs and surplus liquidity into Equity schemes to correct real estate over-concentration."
  * Section 2: Cash Drag vs. Inflation Monitor:
    - Large Metric Card with a speedometer/gauge:
      * Idle Savings Balance: "₹7,55,000" earning 3.0% interest.
      * Prevailing CPI Inflation: "5.4%".
      * Real Drag Loss: "-₹18,120 / year purchasing power erosion".
      * Safe Deployment Buffer: "Move ₹4,00,000 to Liquid Funds or High-Yield Sweep FD".
  * Section 3: Concentration Risk Monitor:
    - Warning Cards:
      * Single Sector Overexposure: "Banking & Financials account for 38% of your overall mutual fund portfolio (Threshold: 25%)".
      * Single Stock Overexposure: "Reliance Industries comprises 9.2% of your liquid market assets".
  * Section 4: Sovereign Gold Bond (SGB) Tracker:
    - Holding Table: Tranche "SGB 2019-20 Series V" | Units: 40g | Issue Price: ₹3,199 | Current Spot: ₹7,240 | Annual Coupon: 2.5% (₹3,200/yr paid semi-annually) | Next Interest Date: "15-Oct-2026" | Redemption: "Maturity Tax-Exempt (2027)".

---

### SCREEN 05: SMS Cashflow & Smart Expense Feed (Tab 3: Spends)
- Screen Goal: Automated Android banking SMS parsing, auto-transfer suppression, and split expense editing.
- Layout:
  * Top Bar: Title "Cashflow & Spends", Month Picker dropdown: "[ September 2026 ▾ ]", Right Button: `[+ Log Cash]`.
  * Monthly Cash Flow Ribbon:
    - 3 Metrics in horizontal row:
      * Inflow: "₹2,10,000" (Emerald)
      * Outflow: "₹64,200" (Slate White)
      * Net Saved: "₹1,45,800 (69.4%)" (Pill badge)
  * Pending Verification Inbox (Collapsible card with yellow accent border):
    - Header: "2 Transactions Need Verification"
    - Item 1: Card "POS BLR XX2019 • ₹3,200" | Date: Today, 2:15 PM | Quick Action Chips: `[ Groceries ]` `[ Shopping ]` `[ Hardware ]` `[ Ignore / Not Expense ]`.
  * Chronological Transaction Stream (Grouped by "Today", "Yesterday"):
    - Card 1 (Standard Expense): Swiggy | Food & Dining | -₹1,450 | "HDFC Bank XX4091 • Member: Self • 8:15 PM" | Category Tag: `Dining`.
    - Card 2 (Detected Internal Self-Transfer): "HDFC Savings ➔ ICICI Credit Card" | Amount: ₹45,000 | Dashed border styling | Badge: "Self-Payment / Transfer (Excluded from Expenses)".
    - Card 3 (Split Transaction): "Smart Supermarket Mart" | Total: -₹10,000 | Sub-elements displayed indented:
      * "₹7,000 Groceries"
      * "₹3,000 Home Cleaning & Supplies"
      * Text link: `[ Edit Split ]`.
    - Card 4 (Cash Spend Logged): "Local Maid Salary" | Cash Payment | -₹8,000 | "Logged Manually • 01-Sep".
    - Card 5 (Investment Outflow): "Zerodha Demat Funds Add" | ₹50,000 | "Detected Broker Transfer • Capital Asset Entry Created".

---

### SCREEN 06: Proactive Financial Calendar & Renewal Timeline
- Screen Goal: Unified chronological horizon tracking FD maturities, premium renewals, and tax milestones.
- Layout:
  * Top Bar: Title "Financial Calendar", Segmented switch: `[ Timeline List ]` | `[ Calendar Grid ]`.
  * Cash Horizon Banner: "Projected Cash Outflow (Next 30 Days): ₹70,900" | "Available Liquid Savings: ₹7,55,000 (Safe Buffer)".
  * Upcoming Milestones Timeline:
    - Date Node: "05-OCT-2026 (In 7 Days)":
      * Event Card (Insurance): "HDFC Ergo Health Floater Renewal" | Amount: ₹28,400 | Member: Family | Grace Period: 30-Oct-2026 | CTA: `[ Mark as Paid ]`.
    - Date Node: "10-OCT-2026 (In 12 Days)":
      * Event Card (SIP Mandate): "SIP Outflows: Parag Parikh & Mirae Large Cap" | Amount: ₹25,000 | Auto-Debit from HDFC XX4091.
    - Date Node: "14-NOV-2026 (In 45 Days)":
      * Event Card (Deposit Maturity): "SBI Term Deposit #4019 Maturing" | Payout Amount: ₹16,06,500 | Destination: SBI A/c XX8812 | Rate Comparison Action: `[ Compare Reinvestment Rates ]`.
    - Date Node: "15-DEC-2026":
      * Event Card (Tax Milestone): "Advance Tax Installment #3 Due" | Estimate: ₹45,000 | Section: Self-Filing Advance Tax.
    - Date Node: "20-JAN-2027":
      * Event Card (Administrative): "Bank Locker Annual Rent Due" | ₹4,500 | Bank of Baroda Bandra Branch.

---

### SCREEN 07: Family Safe Hub & Emergency Succession (Tab 4: Family Safe)
- Screen Goal: Central operational command for inheritance, legal documents, claim helplines, and nominee audits.
- Layout:
  * Top Bar: Shield Icon, Title "Family Safe", Subtitle "Net Worth Manager Succession Ledger".
  * Master Health Banner:
    - Visual Shield graphic with score: "92% Nominees Verified" (Green/Amber ring).
    - Status: "1 Account Missing Nominee • 1 Locker Key Undocumented".
  * Primary Prominent Action Card (Gradient Border with `#6366F1`):
    - Icon: Document Lock
    - Title: "Generate Master Emergency Dossier (ICE Kit)"
    - Subtitle: "Compiles a secure, password-protected PDF containing all folio IDs, bank accounts, locker locations, and claim contacts for your spouse or executor."
    - Primary CTA Button: `[ Export Master ICE Kit ]`.
  * Section 1: Nomination Audit Matrix (Table / Expandable rows):
    - Row 1: "Mutual Fund Folios (14)" -> 100% Nominees Registered (Spouse 100%).
    - Row 2: "Real Estate Deeds (2)" -> 100% Partition / Wills Documented.
    - Row 3: "Fixed Deposits (3)" -> ⚠️ 1 Missing Nominee ("Dad's SBI FD #9402") -> Action chip: `[ Assign ]`.
  * Section 2: Protection & Insurance Registry:
    - Policy Card 1: "HDFC Ergo Optima Restore" | Type: Health Floater (₹25L Sum Assured) | Policy #: 2819-0019-2810 | TPA Helpline: `1800-2666-00` (Direct Dial button) | Network Hospitals Link | Primary Nominee: Spouse (100%).
    - Policy Card 2: "Tata AIA Life Sampoorna Raksha" | Type: Term Life (₹2.0 Cr Sum Assured) | Policy #: 0192837482 | Claim Contact: `1860-266-9966` | Nominee: Spouse (100%).
  * Section 3: Physical Asset & Legal Document Recovery Directory:
    - Directory Card A: "Bank of Baroda Safe Deposit Locker #42" | Branch: Bandra West, Mumbai | Co-signatory: Spouse (Either or Survivor) | Physical Key Location: "Master Godrej Safe (Bedroom), Locker #2, Silver Key Tag".
    - Directory Card B: "Original Land Titles & Deeds" | Khata #412/9B & Apartment Sale Deed | Stored: "Blue Waterproof Folder in Home Safe".
    - Directory Card C: "Registered Physical Will" | Dated: 12-Feb-2024 | Custodian: Adv. S. Deshmukh (CA/Legal Advisor) | Phone: +91 98200 XXXXX.
  * Section 4: Pending Receivables & Reimbursements:
    - Card: "Corporate Health Claim Reimbursement" | Amount: ₹42,500 | TPA Token: MedAssist #84920 | Status: "Pending Hospital Query Resolution".

---

### SCREEN 08: Encrypted Master Dossier (ICE Kit) Export Modal
- Screen Goal: Configurable, client-side AES-encrypted PDF generator for trusted individuals.
- Layout:
  * Modal Sheet Header: Close Button (X), Title "Export Net Worth Manager Dossier (ICE)", Badge: "Zero-Knowledge Local".
  * Step 1: Entity Inclusion Checklist:
    - Checkbox 1: `[x] Entire Family (Consolidated Master)`
    - Checkbox 2: `[ ] Self Only`
    - Checkbox 3: `[ ] Spouse & Kids Only`
    - Checkbox 4: `[ ] Parents Only`
  * Step 2: Information Sensitivity & Masking:
    - Radio Button 1 (Recommended): `(•) Standard Masking` (Shows account numbers like `XX4091`, lists locker numbers and deed locations).
    - Radio Button 2: `( ) Full Unmasked Mode` (Reveals full 16-digit account numbers and customer IDs).
  * Step 3: Security & Passphrase Setup:
    - Instruction: "Set a master decryption password for this PDF. Give this passphrase to your spouse, trusted executor, or store in a physical sealed envelope."
    - Input 1: Master Passphrase input `[ •••••••••••••••••• ]`
    - Input 2: Re-enter Passphrase `[ •••••••••••••••••• ]`
    - Password Strength Meter: "Strong (16 characters, alphanumeric + symbols)".
  * Export Format Toggle:
    - Switch: `[x] Printable Physical Binder Mode` (Optimizes PDF layout with clean high-contrast black-and-white tables suitable for home printing).
  * CTA Button: `[ Compile & Generate Encrypted PDF (ICE Kit) ]`.

---

### SCREEN 09: Detailed Asset Entry: Real Estate & Land Modal
- Screen Goal: Specialized input sheet for immovable properties, survey numbers, compounding growth, and deeds.
- Layout:
  * Header: Cancel, Title "Add Real Estate & Land", Save CTA.
  * Field Group 1: Property Identification:
    - Asset Nickname: Input "Ancestral Agricultural Land, Wardha".
    - Property Type Pills: `[ Agricultural Land ]` `[ Residential Plot ]` `[ Apartment ]` `[ Commercial Office ]`.
    - Property Address & State: Multi-line text field.
  * Field Group 2: Ownership Structure:
    - Owner Selector: Dropdown (Self, Spouse, Father, Joint).
    - Ownership Split %: Slider or Number Input (e.g., "50% Primary Holder, 50% Secondary Holder").
  * Field Group 3: Financial Valuation & Projections:
    - Baseline Acquisition Cost: Input "₹8,50,000".
    - Acquisition Date: Date picker "14-May-1998".
    - Current Estimated Market Value: Input "₹45,00,000".
    - Annual Compounding Appreciation Model: Toggle `[x]` -> Input "6.0 % p.a." (Auto-calculates future trajectory: $A = P(1+r)^t$).
  * Field Group 4: Legal & Safe Recovery:
    - Land Revenue Identifiers: Input "Survey #14/2, Khata #412/9B, Patta #88".
    - Physical Deed Storage Location: Input "Home Godrej Safe Locker #2, Blue Folder".
    - Registered Nominee(s): Name and % share ("Spouse 100%").
    - Attachment: File upload chip `[ + Attach PDF Deed Scan ]` -> Shows `land_partition_deed_1998.pdf` (1.4 MB) with delete icon.
  * Field Group 5: Tax Base Records (For Self-Filing Capital Gains):
    - Stamp Duty Valuation at Registration: "₹6,00,000".
    - Subsequent Improvement Expenses: "+ Add Improvement (e.g., Fencing ₹1.5L in 2012)".

---

### SCREEN 10: Detailed Asset Entry: Fixed Deposit (FD/RD) Modal
- Screen Goal: Banking deposit terms, interest reinvestment mechanics, AIS/26AS tax tracking, and nominee verification.
- Layout:
  * Header: Cancel, Title "Add Fixed / Recurring Deposit", Save CTA.
  * Field Group 1: Bank & Identification:
    - Institution / Bank Name: Dropdown/Search "State Bank of India".
    - Account / Certificate Number: "FD A/c #9402810482".
    - Linked Savings Account: "SBI Savings XX8812".
  * Field Group 2: Terms & Financials:
    - Deposit Principal: Input "₹15,00,000".
    - Interest Rate (% p.a.): Input "7.10 %".
    - Deposit Date & Maturity Date: Pickers "14-Aug-2024" to "14-Aug-2027" (Tenure: 3 Years).
    - Payout Type Segment: `[ Cumulative / Reinvestment at Maturity ]` `[ Monthly Payout ]` `[ Quarterly Payout ]`.
  * Field Group 3: Tax Reconciliation (Form 26AS / AIS):
    - Cumulative Accrued Interest (YTD): Input "₹84,200".
    - TDS Deducted by Bank (YTD): Input "₹8,420".
  * Field Group 4: Succession & Safe Compliance:
    - Nominee Status Toggle: Switch `[x] Registered Nominee Present` -> Name: "Gramina Rosario", Share: "100%".
    - Holding Pattern: `[ Either or Survivor ]` `[ Former or Survivor ]` `[ Single ]`.
    - Physical Deposit Receipt (FDR) Location: Input "Desk Drawer 1 / Green File".
    - Auto-Renewal Alert: Toggle `[x] Notify 30 days & 7 days before maturity`.

---

### SCREEN 11: Detailed Asset Entry: Equities & Mutual Funds Modal
- Screen Goal: Lot-level purchase logging (FIFO for LTCG/STCG) and automated daily market sync.
- Layout:
  * Header: Cancel, Title "Add Market Asset", Save CTA.
  * Field Group 1: Security Type:
    - Segment: `[ Mutual Fund ]` `[ Direct Stock (NSE/BSE) ]` `[ ETF ]` `[ SGB ]`.
    - Auto-Lookup Search: "Search AMFI Scheme Code or Stock Ticker" (e.g., `122639 - Parag Parikh Flexi Cap Fund`).
    - Demat / Folio Details: Folio / Client ID "10482910/22", Broker/Platform: "Zerodha / MFCentral".
  * Field Group 2: Lot-Level Purchase Repeater (FIFO Tax Tracking):
    - Table Repeater with `[+ Add Purchase Lot]`:
      * Lot #1: Date "15-Jan-2023" | Units "850.12" | Buy NAV "₹52.40" | Outflow "₹44,546" | Tag: `LTCG (Sec 112A)`
      * Lot #2: Date "10-Jun-2026" | Units "990.00" | Buy NAV "₹68.10" | Outflow "₹67,419" | Tag: `STCG (Sec 111A)`
  * Field Group 3: Live Valuation Settings:
    - Toggle: `[x] Automated End-of-Day Sync via MFAPI / Yahoo Finance` (Enabled).
    - Calculated Summary: Total Units: "1,840.12" | Latest NAV: "₹84.21" | Current Total: "₹1,54,956".
  * Field Group 4: Depository Nominee Records:
    - Nominee Name: "Spouse", Share: "100%".
    - Depository DP ID / Client ID: "IN300126 / 10293841".

---

### SCREEN 19: Revamped Assets & Wealth Portfolio Tab (Issue #81)
- Screen Goal: Data-dense, institutional-grade assets cockpit with live portfolio stats, multi-attribute free-text search, and multi-segment allocation breakdowns.
- Visual Prototype: `screens/screen_19_revamped_assets_tab.html` & `exports/screen_19_revamped_assets_tab.png`
- Stitch Screen ID: `projects/7450125667546450685/screens/abfae76a80004d8096a09d329e8289d5`
- Layout:
  * Top Bar: Title "Assets & Liabilities", AMFI live pulsing dot badge, Overflow tools menu (⋮), and "+ Add Asset" primary indigo button.
  * Hero Portfolio Cockpit:
    - Filter-scoped Total Valuation (e.g. ₹2,48,50,000) with privacy visibility toggle and all-time profit pill (+₹34.20 L • +18.4% with TrendingUp icon).
    - 3-Metric Subgrid: Invested Cost (₹2,14,30,000), Unrealized Returns (+₹34.20 L with 82% LTCG tag), and Live Coverage (18 Holdings • 12 AMFI Live).
    - Segmented Allocation Breakdown Drawer: Interactive tabs `[By Category]` `[By Owner]` `[By Liquidity]` with stacked distribution progress bar and percentage breakdowns.
    - Action Alert Box (like Pending Verifications in Spends): Amber alert container for upcoming critical events (FD maturities, policy grace periods).
  * Search & Filter Suite:
    - Search input field: "Search asset name, folio, ticker, bank, owner..." with instant clear.
    - Category filter pills with dynamic count badges: All Assets (18), Mutual Funds (7), Equity (5), Cash/FD (3), Gold (2), Real Estate (1).
    - Secondary quick filter chips: Owner selector (All, Self, Spouse) and Sort selector (Valuation High to Low, P&L % Highest).
  * Holdings Ledger: Rich asset cards with live price tags, tax status badges, holding summary metrics, and attachment counters.
  * Docked Bottom Navigation: Persistent 4-tab bar with Assets active.

---

### SCREEN 20: Assets Tab - Family Owner Stats & Member Filter View (Issue #81)
- Screen Goal: Scoped family office member perspective, dynamically recalculating portfolio valuation, returns, invested basis, and asset class allocation for an individual owner (or Joint holding).
- Visual Prototype: `screens/screen_20_assets_owner_filter_stats.html` & `exports/screen_20_assets_owner_filter_stats.png`
- Stitch Screen ID: `projects/7450125667546450685/screens/e1d2593d503b4515957bcbdeb10c8fbd`
- Layout:
  * Family Owner Switcher Carousel (Horizontal scrollable strip):
    - Pills: `[ 👥 All Family (₹2.48 Cr) ]`, `[ 👤 Maria (Spouse) • ₹84.2 L ]` (Selected state with indigo glow), `[ 👤 Nozel (Self) • ₹1.64 Cr ]`, `[ 🤝 Joint Holdings • ₹45.0 L ]`.
  * Scoped Portfolio Cockpit (Scoped to Selected Owner):
    - Member header tag: "Viewing: Maria Rosario (Spouse)" with avatar and verification badge.
    - Scoped Valuation: ₹84,20,000 with net return pill `+₹9.40 L (+12.6%)`.
    - 3-Metric Subgrid: Maria's Invested Basis (₹74,80,000), Maria's Net P&L (+₹9.40 L • LTCG ₹7.2 L), Maria's Holdings (7 Assets • 5 AMFI Live).
    - Scoped Segmented Breakdown: Maria's asset allocation (Mutual Funds 52% • ₹43.8 L, FDs 30% • ₹25.0 L, Gold 18% • ₹15.4 L).
  * Member Search & Active Filter Suite:
    - Search: "Search Maria's assets...".
    - Active Filter Chip: `[Owner: Maria (Spouse) ✕]` with "Reset to All Family" shortcut.
    - Scoped Category Pills: All (7), Mutual Funds (4), Cash/FD (2), Gold (1).
  * Scoped Holdings List: Displaying only the selected owner's instruments with explicit `Owner: Maria (Spouse)` badges.

---

### SCREEN 21: Streamlined Assets Tab - Space-Optimized Clean Cockpit (Issue #81)
- Screen Goal: Maximum vertical real estate efficiency by removing the bulky 3 sub-cards (Invested Basis, Unrealized P&L, Live Coverage). Replaces them with an ultra-compact single valuation ribbon, slim 6px allocation mini-bar, and compact 1-line action alert, pulling holding cards immediately high into the primary viewport.
- Visual Prototype: `screens/screen_21_streamlined_assets_tab.html` & `exports/screen_21_streamlined_assets_tab.png`
- Stitch Screen ID: `projects/7450125667546450685/screens/f68559ff9d4b4cc78458a3130b60b449`
- Layout:
  * Top Bar: Title "Assets & Liabilities", AMFI live pulsing dot badge, Overflow tools menu (⋮), and "+ Add Asset" primary indigo button.
  * Family Owner Switcher Carousel: Horizontal pill strip (`All Family`, `Maria`, `Nozel`, `Joint`).
  * Ultra-Compact Valuation Ribbon (Single high-density card, NO 3 sub-cards):
    - Inline pair: Total Portfolio Valuation `₹2,48,50,000` (with privacy toggle) directly beside all-time return pill `+₹34.20 L (+18.4%)`.
    - Integrated 6px Multi-Color Allocation Mini-Bar directly under valuation (MF 48%, EQ 26%, RE 18%, Gold 8%).
    - Compact 1-line legend & segment filter tabs (`[By Category]` `[By Owner]` `[By Liquidity]`).
    - Compact 1-line Action Alert ribbon: `⚠️ 2 Actions: HDFC FD Matures in 14d • LIC Grace active >`.
  * Universal Search Bar & Category Pills with dynamic counts.
  * Holdings Ledger immediately visible in upper fold.

---

### SCREEN 22: Global Macro Weather Dashboard & Regime Panel (Issue #75 Phase 1)
- Screen Goal: Real-time macro weather bar and expandable regime cockpit providing contrarian signals, liquidity warning flags, and valuation context streamed via native `=GOOGLEFINANCE(...)`.
- Visual Prototype: `screens/screen_22_global_macro_weather.html` & `exports/screen_22_global_macro_weather.png`
- Stitch Screen ID: `projects/7450125667546450685/screens/cd2847f2d04f4fffb199b3c9465eccd4`
- Layout:
  * Collapsible Header Weather Ribbon: Weather icon + "Macro Regime: Risk-On Expansion" badge with composite score ring (78/100) and chevron.
  * 6-Indicator Quantitative Weather Grid (2x3):
    - US 10Y Yield (INDEXCBOE:TNX): 4.32% (↑ FII outflow sensitivity tag)
    - USD/INR (CURRENCY:USDINR): ₹83.42 (Imported inflation / currency depreciation barometer)
    - Brent Crude: $78.50/bbl (Fiscal deficit & oil sensitivity safe zone <$90)
    - India VIX (INDEXNSE:INDIAVIX): 13.8 (Volatility gauge & opportunistic dip-buying trigger >22)
    - Gold / Silver Ratio: 82.4 (Defensive risk sentiment barometer)
    - Nifty 50 200-Day EMA: "Above 200 EMA" (Dual momentum structural trend filter)
  * Composite Regime Bar: 78/100 Risk-On Expansion meter with last-sync timestamp.

---

### SCREEN 23: Tactical Fresh Inflow Simulator - Dual Momentum & Macro Overlay (Issue #75 Phase 2)
- Screen Goal: Dynamic modulation of monthly fresh capital tranches using 200-day trend lines and macro regime multipliers to prevent catching falling knives while avoiding tax-triggering portfolio rebalance sales.
- Visual Prototype: `screens/screen_23_tactical_inflow_simulator.html` & `exports/screen_23_tactical_inflow_simulator.png`
- Stitch Screen ID: `projects/7450125667546450685/screens/81ee6411aca5467f869a49f0c205d5b6`
- Layout:
  * Mode Switcher Toggle: `[ Strategic Baseline ]` vs `[ Tactical Macro Overlay ✨ (Active) ]`.
  * Inflow Amount Input: Tabular-nums capital input (e.g. ₹1,00,000) with quick chips (`₹25,000`, `₹50,000`, `₹1,00,000`, `₹2,50,000`).
  * Signal Banner: Live regime triggers ("Price > 200 EMA", "Gold Bullish", "Tactical Multipliers: Equity 1.25x | Cash/FD 0.6x").
  * Before vs After Allocation Table: Proportional shortfall allocation across Equity, Mutual Funds, Gold, Arbitrage, Real Estate with projected percentages and target gaps.
  * Alignment Score Boost Card: "Score: 74 → 88 (+14 pts)" with Section 112A/111A zero-tax shield badge.
  * Sticky Execution CTA: "Execute Rebalance Plan & Log Inflows".

---

### SCREEN 24: Hierarchical Risk Parity (HRP) & CVaR Tail-Risk Stress Test (Issue #75 Phase 3)
- Screen Goal: Institutional ML-based risk parity diversification without unstable covariance matrix inversion, coupled with automated 95% CVaR tail-risk downside budgeting.
- Visual Prototype: `screens/screen_24_hrp_cvar_stress_test.html` & `exports/screen_24_hrp_cvar_stress_test.png`
- Stitch Screen ID: `projects/7450125667546450685/screens/23c87a87045c4986b5ddc65adc9da45a`
- Layout:
  * Risk Profile Carousel: Moderate, Aggressive, Conservative, All-Weather, and `[ 🧠 ML HRP (Optimal) ]` (with emerald glow).
  * HRP Cluster Explainer: Tree linkage dendrogram preview explaining correlation-distance metric and recursive bisection advantages over classical Markowitz MVO.
  * Tail Risk Stress Test Hero Badge:
    - Expected Max 1-Month Drawdown: "-11.4% (Worst 5% tail scenario: ₹2,85,000)".
    - Multi-benchmark Risk Gauge: Nifty 50 (-15.8%), Your Portfolio (-11.4%), All-Weather (-6.2%).
    - Tail Risk Alpha: "Absorbs 28% less tail drawdown than pure equity index".
  * Side-by-Side Allocation Drift: Current vs ML-Optimized asset class weights.

---

### SCREEN 25: Next-Gen Institutional Instruments & Discovery Hub (Issue #75 Phase 4)
- Screen Goal: Fiduciary discovery and performance tracking for modern Indian investment vehicles replacing low-yield bank FDs and illiquid residential real estate.
- Visual Prototype: `screens/screen_25_nextgen_instruments_hub.html` & `exports/screen_25_nextgen_instruments_hub.png`
- Stitch Screen ID: `projects/7450125667546450685/screens/52e9d4230261428ab21ce49e98db7c28`
- Layout:
  * Filter Chips: `[ All (5) ]` `[ REITs & InvITs ]` `[ Target Maturity (TMF) ]` `[ SGB Arbitrage ]` `[ Smart Beta ETFs ]`.
  * Instrument Feature Cards:
    - REITs & InvITs (Nexus / Embassy / PowerGrid): 7.65% Net Distribution Yield, Sec 10(23FD) tax-free distributions, 31% LTV.
    - Target Maturity Debt Funds (BHARAT Bond / Nifty SDL 2028): 7.42% Locked YTM, AAA Sovereign rating, zero credit risk FD replacement.
    - Sovereign Gold Bond Secondary Arbitrage: Traded at -3.2% discount to spot gold, 2.5% semi-annual coupon, 0% GST, 100% tax-free LTCG at maturity.
    - Smart Beta Factor ETFs: Nifty 200 Momentum 30 (MOM30IETFS) with dual momentum rule.
  * Zero-Affiliate Fiduciary Guarantee footer note.



