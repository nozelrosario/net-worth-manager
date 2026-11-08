export const assetSchemas = {
  'Cash/FD': {
    title: 'Bank, Savings & Fixed Deposits',
    fields: [
      {
        name: 'Details JSON.Sub-Type',
        label: 'Account / Deposit Sub-Type',
        type: 'select',
        options: ['Savings Account', 'Fixed Deposit (FD)', 'Recurring Deposit (RD)', 'Target Maturity Fund (TMF)', 'Liquid / Arbitrage Fund', 'Cash in Hand'],
        required: true,
        hint: 'Savings Accounts are tracked as liquid cash and can auto-sync balances from bank SMS.'
      },
      { name: 'Name', label: 'Account / Deposit Name', type: 'text', placeholder: 'e.g. HDFC Salary Account, SBI Savings, 3Y FD', required: true },
      { name: 'Institution/Location', label: 'Institution / Bank Name', type: 'text', placeholder: 'e.g. State Bank of India, HDFC Bank', required: true },
      { name: 'Identifiers', label: 'Account / FD Number (or Last 4 Digits)', type: 'text', placeholder: 'e.g. 7735 or XX7735 (used to match bank SMS)' },
      { 
        name: 'Cost', 
        label: 'Deposit Principal (₹)', 
        type: 'number',
        condition: (fd) => {
          const st = fd['Details JSON']?.['Sub-Type'];
          return st === 'Fixed Deposit (FD)' || st === 'Recurring Deposit (RD)' || (!st && (fd['Details JSON']?.['Maturity Date'] || fd.Cost));
        }
      },
      { 
        name: 'Current Value', 
        label: 'Current Balance / Valuation (₹)', 
        type: 'number', 
        required: true,
        hint: 'Can be updated manually anytime or auto-synced from bank SMS'
      },
      { name: 'Acquisition Date', label: 'Opening / Deposit Date', type: 'date' },
      { 
        name: 'Details JSON.Maturity Date', 
        label: 'Maturity Date', 
        type: 'date',
        condition: (fd) => {
          const st = fd['Details JSON']?.['Sub-Type'];
          return st === 'Fixed Deposit (FD)' || st === 'Recurring Deposit (RD)' || (!st && (fd['Details JSON']?.['Maturity Date'] || fd['Details JSON']?.['Interest Rate']));
        }
      },
      { 
        name: 'Details JSON.Interest Rate', 
        label: 'Interest Rate (% p.a.)', 
        type: 'number', 
        step: '0.01',
        condition: (fd) => {
          const st = fd['Details JSON']?.['Sub-Type'];
          return st === 'Fixed Deposit (FD)' || st === 'Recurring Deposit (RD)' || (!st && (fd['Details JSON']?.['Interest Rate'] || fd['Details JSON']?.['Maturity Date']));
        }
      },
      { 
        name: 'Details JSON.Payout Frequency', 
        label: 'Payout Frequency Mode', 
        type: 'select', 
        options: ['Cumulative', 'Monthly', 'Quarterly', 'Annual'],
        condition: (fd) => {
          const st = fd['Details JSON']?.['Sub-Type'];
          return st === 'Fixed Deposit (FD)' || st === 'Recurring Deposit (RD)';
        }
      },
      { 
        name: 'Details JSON.Auto Renewal', 
        label: 'Auto-Renewal Enabled', 
        type: 'checkbox',
        condition: (fd) => {
          const st = fd['Details JSON']?.['Sub-Type'];
          return st === 'Fixed Deposit (FD)';
        }
      },
      {
        name: 'Details JSON.Auto-Sweep Linked',
        label: 'Auto-Sweep / MOD Linked (Sweeps surplus to FD)',
        type: 'checkbox',
        condition: (fd) => {
          const st = fd['Details JSON']?.['Sub-Type'];
          return st === 'Savings Account' || (!st && !fd['Details JSON']?.['Maturity Date'] && !fd.Cost);
        }
      },
      { 
        name: 'Details JSON.Locked YTM', 
        label: 'Locked YTM (% p.a.)', 
        type: 'number', 
        step: '0.01',
        placeholder: 'e.g. 7.42',
        condition: (fd) => fd['Details JSON']?.['Sub-Type'] === 'Target Maturity Fund (TMF)'
      },
      { 
        name: 'Details JSON.Target Maturity Year', 
        label: 'Target Maturity Year', 
        type: 'number',
        placeholder: 'e.g. 2028 or 2030',
        condition: (fd) => fd['Details JSON']?.['Sub-Type'] === 'Target Maturity Fund (TMF)'
      },
      { 
        name: 'Details JSON.Credit Quality', 
        label: 'Credit Quality / Sovereign Guarantee', 
        type: 'select',
        options: ['Sovereign (G-Sec / SDL)', 'AAA Public Sector (PSU)', 'Corporate AAA'],
        condition: (fd) => fd['Details JSON']?.['Sub-Type'] === 'Target Maturity Fund (TMF)'
      },
      { name: 'Owner', label: 'Holding Pattern / Owner', type: 'text', placeholder: 'e.g. Joint, Single' },
      { name: 'Nominee', label: 'Nominee Name', type: 'text' }
    ]
  },
  'Equity': {
    title: 'Direct Equity & Factor ETFs',
    fields: [
      { name: 'Name', label: 'Company / ETF Name', type: 'text', placeholder: 'e.g. Reliance Industries, Nifty 200 Momentum 30 ETF', required: true },
      { 
        name: 'Details JSON.Instrument Type', 
        label: 'Equity Instrument Type', 
        type: 'select', 
        options: ['Direct Stock', 'Factor / Smart Beta ETF', 'International Feeder ETF'],
        default: 'Direct Stock'
      },
      { 
        name: 'Details JSON.Factor Strategy', 
        label: 'Factor Strategy', 
        type: 'select', 
        options: ['Momentum 30', 'Alpha Low-Volatility 30', 'Low Volatility 50', 'Quality 30', 'Nasdaq 100 Feeder', 'S&P 500 Feeder'],
        condition: (fd) => fd['Details JSON']?.['Instrument Type'] === 'Factor / Smart Beta ETF' || fd['Details JSON']?.['Instrument Type'] === 'International Feeder ETF'
      },
      { 
        name: 'Details JSON.TER', 
        label: 'Total Expense Ratio - TER (%)', 
        type: 'number',
        step: '0.01',
        placeholder: 'e.g. 0.25',
        condition: (fd) => fd['Details JSON']?.['Instrument Type'] === 'Factor / Smart Beta ETF' || fd['Details JSON']?.['Instrument Type'] === 'International Feeder ETF'
      },
      { name: 'Details JSON.Ticker Symbol', label: 'Ticker Symbol (NSE / BSE / US)', type: 'text', placeholder: 'e.g. NSE:RELIANCE, NSE:MOM30IETFS, NASDAQ:AAPL' },
      { name: 'Details JSON.Live Tracking', label: 'Track Live Valuation (Google Finance)', type: 'checkbox', default: true },
      { name: 'Institution/Location', label: 'Broker / Demat Account', type: 'text', placeholder: 'e.g. Zerodha, Groww' },
      { name: 'Details JSON.Quantity', label: 'Quantity (Shares)', type: 'number', step: '1' },
      { name: 'Details JSON.Average Buy Price', label: 'Average Buy Price (₹)', type: 'number', step: '0.01' },
      { name: 'Acquisition Date', label: 'Purchase Date (optional)', type: 'date', hint: 'Leave blank if unknown; return will be calculated from Average Buy Price' },
      { name: 'Cost', label: 'Total Invested Amount (₹)', type: 'number', hint: 'Auto-calculated from Quantity × Average Buy Price' },
      { name: 'Current Value', label: 'Current Market Value (₹)', type: 'number', required: true },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  },
  'Mutual Funds': {
    title: 'Mutual Funds',
    fields: [
      { name: 'Name', label: 'Scheme Name', type: 'text', placeholder: 'e.g. Parag Parikh Flexi Cap Fund', required: true },
      { name: 'Details JSON.Scheme Code', label: 'AMFI Scheme Code / Ticker', type: 'text', placeholder: 'e.g. 122639 or search scheme' },
      { name: 'Details JSON.Live Tracking', label: 'Track Live NAV Valuation', type: 'checkbox', default: true },
      { name: 'Institution/Location', label: 'AMC / Fund House', type: 'text', placeholder: 'e.g. PPFAS Mutual Fund' },
      { name: 'Identifiers', label: 'Folio Number', type: 'text' },
      { name: 'Details JSON.Units', label: 'Units Held', type: 'number', step: '0.001' },
      { name: 'Details JSON.Average NAV', label: 'Average Purchase NAV (₹)', type: 'number', step: '0.0001' },
      { name: 'Acquisition Date', label: 'Purchase / Investment Date', type: 'date' },
      { name: 'Cost', label: 'Total Invested Amount (₹)', type: 'number' },
      { name: 'Current Value', label: 'Current Market Value (₹)', type: 'number', required: true },
      { name: 'Details JSON.SIP Active', label: 'SIP Active', type: 'checkbox' },
      { name: 'Details JSON.SIP Amount', label: 'SIP Amount (₹)', type: 'number', condition: (fd) => fd['Details JSON']?.['SIP Active'] === true },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  },
  'Real Estate': {
    title: 'Real Estate & REITs',
    fields: [
      { name: 'Name', label: 'Property / REIT Nickname', type: 'text', required: true },
      { name: 'Details JSON.Property Type', label: 'Type', type: 'select', options: ['Residential', 'Commercial', 'Plot', 'Agricultural', 'REIT / InvIT Unit'] },
      { name: 'Institution/Location', label: 'Full Address / Exchange Ticker', type: 'text', placeholder: 'e.g. NSE:EMBASSY, Bandra West Flat' },
      { name: 'Acquisition Date', label: 'Purchase Date', type: 'date' },
      { name: 'Cost', label: 'Purchase Price / Invested Capital', type: 'number' },
      { name: 'Current Value', label: 'Current Estimated Market Value', type: 'number' },
      { 
        name: 'Details JSON.Distribution Yield', 
        label: 'Net Distribution Yield (% p.a.)', 
        type: 'number', 
        step: '0.01',
        placeholder: 'e.g. 7.65',
        condition: (fd) => fd['Details JSON']?.['Property Type'] === 'REIT / InvIT Unit'
      },
      { 
        name: 'Details JSON.Distribution Frequency', 
        label: 'Payout Frequency', 
        type: 'select',
        options: ['Quarterly', 'Semi-Annual', 'Annual'],
        condition: (fd) => fd['Details JSON']?.['Property Type'] === 'REIT / InvIT Unit'
      },
      { 
        name: 'Details JSON.LTV Ratio', 
        label: 'Portfolio Loan-to-Value (LTV %)', 
        type: 'number',
        placeholder: 'e.g. 31',
        condition: (fd) => fd['Details JSON']?.['Property Type'] === 'REIT / InvIT Unit'
      },
      { 
        name: 'Details JSON.Sec 10(23FD) Exempt', 
        label: 'Sec 10(23FD) Tax Exempt Distributions (Debt Repayment)', 
        type: 'checkbox',
        condition: (fd) => fd['Details JSON']?.['Property Type'] === 'REIT / InvIT Unit'
      },
      { name: 'Details JSON.7/12 Extract', label: '7/12 Extract Number', type: 'text', condition: (fd) => fd['Details JSON']?.['Property Type'] === 'Agricultural' },
      { name: 'Details JSON.Loan Linked', label: 'Linked Home Loan', type: 'checkbox', condition: (fd) => fd['Details JSON']?.['Property Type'] !== 'REIT / InvIT Unit' },
      { name: 'Details JSON.Rented Out', label: 'Is Rented Out?', type: 'checkbox', condition: (fd) => fd['Details JSON']?.['Property Type'] !== 'REIT / InvIT Unit' },
      { name: 'Details JSON.Monthly Rent', label: 'Monthly Rent Amount', type: 'number', condition: (fd) => fd['Details JSON']?.['Rented Out'] === true && fd['Details JSON']?.['Property Type'] !== 'REIT / InvIT Unit' },
      { name: 'Owner', label: 'Ownership / Co-owners', type: 'text' }
    ]
  },
  'Gold': {
    title: 'Gold & Precious Metals',
    fields: [
      { name: 'Name', label: 'Asset Name / Description', type: 'text', placeholder: 'e.g. Sovereign Gold Bond 2028 / Gold Coins', required: true },
      { 
        name: 'Details JSON.Form Factor', 
        label: 'Type / Form Factor', 
        type: 'select', 
        options: ['Physical Jewelry', 'Gold Coins/Bars', 'Digital Gold', 'Gold ETFs', 'Sovereign Gold Bonds (SGB)', 'Sovereign Gold Bonds (Secondary Market)'],
        required: true
      },
      {
        name: 'Details JSON.Purity',
        label: 'Gold Purity',
        type: 'select',
        options: ['24K (99.9% - Bullion / Coins / Bars / Digital)', '22K (91.6% - Standard Jewelry)', '18K (75.0% - Diamond Jewelry)'],
        condition: (fd) => {
          const ff = fd['Details JSON']?.['Form Factor'] || '';
          return !ff.includes('ETF') && !ff.includes('SGB');
        }
      },
      {
        name: 'Details JSON.Ticker Symbol',
        label: 'Ticker Symbol (NSE / BSE)',
        type: 'text',
        placeholder: 'e.g. NSE:GOLDBEES, NSE:SGBOCT28I',
        condition: (fd) => {
          const ff = fd['Details JSON']?.['Form Factor'] || '';
          return ff.includes('ETF') || ff.includes('SGB');
        }
      },
      {
        name: 'Details JSON.Weight (Grams)',
        label: 'Weight (Grams)',
        type: 'number',
        step: '0.01',
        condition: (fd) => {
          const ff = fd['Details JSON']?.['Form Factor'] || '';
          return !ff.includes('ETF') && !ff.includes('SGB');
        }
      },
      {
        name: 'Details JSON.Units',
        label: 'Units Held',
        type: 'number',
        step: '1',
        condition: (fd) => {
          const ff = fd['Details JSON']?.['Form Factor'] || '';
          return ff.includes('ETF') || ff.includes('SGB');
        }
      },
      {
        name: 'Details JSON.Traded Discount',
        label: 'Traded Discount to Spot (%)',
        type: 'number',
        step: '0.1',
        placeholder: 'e.g. 3.2',
        condition: (fd) => (fd['Details JSON']?.['Form Factor'] || '').includes('Secondary')
      },
      {
        name: 'Details JSON.Maturity Series',
        label: 'Maturity Series & Year',
        type: 'text',
        placeholder: 'e.g. SGB 2031-32 Series IV',
        condition: (fd) => (fd['Details JSON']?.['Form Factor'] || '').includes('SGB')
      },
      {
        name: 'Details JSON.Coupon Rate',
        label: 'Semi-Annual Coupon Rate (% p.a.)',
        type: 'number',
        step: '0.1',
        default: 2.5,
        condition: (fd) => (fd['Details JSON']?.['Form Factor'] || '').includes('SGB')
      },
      { name: 'Details JSON.Live Tracking', label: 'Track Live Valuation (Google Finance)', type: 'checkbox', default: true },
      { name: 'Acquisition Date', label: 'Purchase Date', type: 'date' },
      { name: 'Cost', label: 'Purchase Cost / Invested (₹)', type: 'number' },
      { name: 'Current Value', label: 'Current Market Value (₹)', type: 'number', required: true },
      { name: 'Institution/Location', label: 'Location (Locker / Safe / Demat)', type: 'text', placeholder: 'e.g. SBI Bank Locker #142' },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  },
  'Retirement & Pension': {
    title: 'Retirement & Pension Hub (EPF, PPF & NPS)',
    fields: [
      { name: 'Name', label: 'Account Nickname', type: 'text', placeholder: 'e.g. EPFO - TCS, HDFC NPS Tier 1, SBI PPF', required: true },
      { 
        name: 'Details JSON.Retirement Type', 
        label: 'Retirement Instrument Type', 
        type: 'select', 
        options: [
          'EPF / VPF (Employees\' Provident Fund)',
          'NPS Tier 1 (Pension Corpus)',
          'NPS Tier 2 (Liquid)',
          'PPF (Public Provident Fund)',
          'Superannuation & Gratuity'
        ],
        required: true
      },
      { name: 'Identifiers', label: 'Account Identifier (UAN / PRAN / PPF A/c #)', type: 'text', placeholder: 'e.g. UAN 101489238472 or PRAN 110092837461' },
      { name: 'Institution/Location', label: 'Institution / PFM / Bank', type: 'text', placeholder: 'e.g. EPFO, HDFC Pension, State Bank of India' },
      
      // Values & Balances
      { name: 'Cost', label: 'Total Contributions / Invested (₹)', type: 'number' },
      { name: 'Current Value', label: 'Current Balance / Corpus Value (₹)', type: 'number', required: true },
      
      // EPF Specific Fields
      { 
        name: 'Details JSON.Member ID', 
        label: 'EPFO Member ID / Establishment Code', 
        type: 'text',
        placeholder: 'e.g. MHBAN00123450000012345',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Employee Share', 
        label: 'Employee Share Balance (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Employer Share', 
        label: 'Employer Share Balance (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.EPS Pension Share', 
        label: 'Pension Fund (EPS) Balance (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Monthly Employee Contribution', 
        label: 'Monthly Employee Contribution (₹)', 
        type: 'number',
        placeholder: 'e.g. 10800',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Monthly Employer Contribution', 
        label: 'Monthly Employer Contribution (₹)', 
        type: 'number',
        placeholder: 'e.g. 10800',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Monthly VPF Contribution', 
        label: 'Monthly Voluntary PF (VPF) (₹)', 
        type: 'number',
        placeholder: 'e.g. 5000',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Interest Rate', 
        label: 'EPFO Declared Rate (% p.a.)', 
        type: 'number', 
        step: '0.01',
        placeholder: '8.25',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },

      // NPS Specific Fields
      { 
        name: 'Details JSON.Investment Choice', 
        label: 'NPS Investment Mode', 
        type: 'select',
        options: ['Active Choice', 'Auto Choice - Aggressive (LC75)', 'Auto Choice - Moderate (LC50)', 'Auto Choice - Conservative (LC25)'],
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Allocation Equity E', 
        label: 'Asset Class E - Equity (%) [up to 75%]', 
        type: 'number',
        step: '1',
        placeholder: '60',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Allocation Corp Debt C', 
        label: 'Asset Class C - Corporate Debt (%)', 
        type: 'number',
        step: '1',
        placeholder: '25',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Allocation Govt Sec G', 
        label: 'Asset Class G - Govt Securities (%)', 
        type: 'number',
        step: '1',
        placeholder: '15',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Allocation Alternative A', 
        label: 'Asset Class A - Alternative Inv (%)', 
        type: 'number',
        step: '1',
        placeholder: '0',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Monthly Self SIP', 
        label: 'Monthly Self SIP (Sec 80CCD 1B) (₹)', 
        type: 'number',
        placeholder: 'e.g. 5000',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Monthly Employer 80CCD2', 
        label: 'Monthly Employer Perk (Sec 80CCD 2) (₹)', 
        type: 'number',
        placeholder: 'e.g. 7500',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },

      // PPF Specific Fields
      { 
        name: 'Details JSON.FY Deposit Amount', 
        label: 'Deposited in Current FY (₹) [Max ₹1.5L for 80C]', 
        type: 'number',
        placeholder: 'e.g. 150000',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('PPF')
      },
      { 
        name: 'Acquisition Date', 
        label: 'Account Opening Date', 
        type: 'date',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('PPF')
      },
      { 
        name: 'Details JSON.Maturity Date', 
        label: '15-Year Maturity Date', 
        type: 'date',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('PPF')
      },
      { 
        name: 'Details JSON.Extension Block', 
        label: 'Maturity Extension Block', 
        type: 'select',
        options: ['Original 15 Years', 'Block 1 (16-20 Years)', 'Block 2 (21-25 Years)', 'Block 3 (26-30 Years)'],
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('PPF')
      },
      { 
        name: 'Details JSON.Interest Rate', 
        label: 'PPF Interest Rate (% p.a.)', 
        type: 'number', 
        step: '0.01',
        placeholder: '7.10',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('PPF')
      },

      // Superannuation & Gratuity
      { 
        name: 'Details JSON.Tenure Years', 
        label: 'Tenure of Service (Years)', 
        type: 'number',
        step: '0.5',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('Gratuity') || (fd['Details JSON']?.['Retirement Type'] || '').includes('Superannuation')
      },
      { 
        name: 'Details JSON.Monthly Basic', 
        label: 'Last Drawn Monthly Basic + DA (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('Gratuity')
      },

      { name: 'Owner', label: 'Owner / Primary Member', type: 'text' },
      { name: 'Nominee', label: 'Nominee Name & Relationship', type: 'text' }
    ]
  },
  'Provident Funds': {
    title: 'Provident Funds & NPS',
    fields: [
      { name: 'Name', label: 'Account Nickname', type: 'text', placeholder: 'e.g. EPFO - TCS, HDFC NPS Tier 1, SBI PPF', required: true },
      { 
        name: 'Details JSON.Retirement Type', 
        label: 'Retirement Instrument Type', 
        type: 'select', 
        options: [
          'EPF / VPF (Employees\' Provident Fund)',
          'NPS Tier 1 (Pension Corpus)',
          'NPS Tier 2 (Liquid)',
          'PPF (Public Provident Fund)',
          'Superannuation & Gratuity'
        ],
        required: true
      },
      { name: 'Identifiers', label: 'Account Identifier (UAN / PRAN / PPF A/c #)', type: 'text', placeholder: 'e.g. UAN 101489238472 or PRAN 110092837461' },
      { name: 'Institution/Location', label: 'Institution / PFM / Bank', type: 'text', placeholder: 'e.g. EPFO, HDFC Pension, State Bank of India' },
      { name: 'Cost', label: 'Total Contributions / Invested (₹)', type: 'number' },
      { name: 'Current Value', label: 'Current Balance / Corpus Value (₹)', type: 'number', required: true },
      
      // EPF
      { 
        name: 'Details JSON.Monthly Employee Contribution', 
        label: 'Monthly Employee Contribution (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Monthly Employer Contribution', 
        label: 'Monthly Employer Contribution (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Monthly VPF Contribution', 
        label: 'Monthly Voluntary PF (VPF) (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('EPF')
      },
      { 
        name: 'Details JSON.Interest Rate', 
        label: 'Declared Interest Rate (% p.a.)', 
        type: 'number', 
        step: '0.01',
        placeholder: '8.25'
      },

      // NPS
      { 
        name: 'Details JSON.Allocation Equity E', 
        label: 'Asset Class E - Equity (%) [up to 75%]', 
        type: 'number',
        step: '1',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Allocation Corp Debt C', 
        label: 'Asset Class C - Corporate Debt (%)', 
        type: 'number',
        step: '1',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Allocation Govt Sec G', 
        label: 'Asset Class G - Govt Securities (%)', 
        type: 'number',
        step: '1',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },
      { 
        name: 'Details JSON.Monthly Self SIP', 
        label: 'Monthly Self SIP (Sec 80CCD 1B) (₹)', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('NPS')
      },

      // PPF
      { 
        name: 'Details JSON.FY Deposit Amount', 
        label: 'Deposited in Current FY (₹) [Max ₹1.5L for 80C]', 
        type: 'number',
        condition: (fd) => (fd['Details JSON']?.['Retirement Type'] || '').includes('PPF')
      },
      { 
        name: 'Details JSON.Maturity Date', 
        label: 'Maturity / Lock-in Expiry Date', 
        type: 'date'
      },
      
      { name: 'Owner', label: 'Owner', type: 'text' },
      { name: 'Nominee', label: 'Nominee Name', type: 'text' }
    ]
  },
  'Bonds': {
    title: 'Bonds & Debentures',
    fields: [
      { name: 'Name', label: 'Bond Name / Series', type: 'text', required: true },
      { name: 'Institution/Location', label: 'Issuer Name', type: 'text', placeholder: 'e.g. RBI, NHAI' },
      { name: 'Identifiers', label: 'ISIN / Certificate Number', type: 'text' },
      { name: 'Details JSON.Face Value', label: 'Face Value per Unit', type: 'number' },
      { name: 'Details JSON.Units', label: 'Number of Units', type: 'number' },
      { name: 'Details JSON.Coupon Rate', label: 'Coupon / Interest Rate (%)', type: 'number', step: '0.01' },
      { name: 'Cost', label: 'Total Invested Amount', type: 'number' },
      { name: 'Current Value', label: 'Current Value', type: 'number', required: true },
      { name: 'Acquisition Date', label: 'Purchase Date', type: 'date' },
      { name: 'Details JSON.Maturity Date', label: 'Maturity Date', type: 'date' },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  },
  'Liabilities': {
    title: 'Loans & Liabilities',
    fields: [
      { name: 'Name', label: 'Loan Nickname', type: 'text', required: true },
      { name: 'Details JSON.Loan Type', label: 'Type', type: 'select', options: ['Home Loan', 'Auto Loan', 'Personal Loan', 'Credit Card', 'Other'] },
      { name: 'Institution/Location', label: 'Lender / Bank', type: 'text' },
      { name: 'Identifiers', label: 'Loan Account Number', type: 'text' },
      { name: 'Cost', label: 'Original Loan Amount', type: 'number' },
      { name: 'Current Value', label: 'Principal Outstanding', type: 'number', required: true },
      { name: 'Details JSON.EMI Amount', label: 'EMI Amount', type: 'number' },
      { name: 'Details JSON.Interest Rate', label: 'Interest Rate (% p.a.)', type: 'number', step: '0.01' },
      { name: 'Owner', label: 'Borrower / Co-borrower', type: 'text' }
    ]
  },
  'Life Insurance / LIC': {
    title: 'Life Insurance & LIC Policies',
    fields: [
      { name: 'Name', label: 'Policy Name / Scheme', type: 'text', placeholder: 'e.g. LIC Jeevan Labh, HDFC Click 2 Protect', required: true },
      { 
        name: 'Details JSON.Policy Type', 
        label: 'Policy Category / Type', 
        type: 'select', 
        options: [
          'Endowment Plan (Savings + Life Cover)',
          'Money Back Plan (Periodic Survival Benefits)',
          'Whole Life Plan (e.g. Jeevan Umang)',
          'ULIP (Unit Linked Insurance Plan)',
          'Pension / Immediate Annuity Plan',
          'Pure Term Insurance (Risk Protection Only)',
          'Health Insurance (Mediclaim)',
          'Motor & Vehicle Insurance'
        ],
        required: true
      },
      { name: 'Institution/Location', label: 'Insurer / Organization', type: 'text', placeholder: 'e.g. Life Insurance Corporation of India (LIC)' },
      { name: 'Identifiers', label: 'Policy Number', type: 'text', placeholder: 'e.g. 863920192', required: true },
      { name: 'Details JSON.Servicing Branch', label: 'Servicing Branch & Code', type: 'text', placeholder: 'e.g. Mumbai Branch 883' },
      
      // Valuations & Cost
      { 
        name: 'Cost', 
        label: 'Cumulative Premiums Paid to Date (₹)', 
        type: 'number', 
        required: true 
      },
      { 
        name: 'Current Value', 
        label: 'Current Surrender / Accrued Value (₹)', 
        type: 'number', 
        required: true 
      },
      
      // Coverage & Terms
      { 
        name: 'Details JSON.Sum Assured', 
        label: 'Life Cover / Sum Assured (₹)', 
        type: 'number', 
        placeholder: 'e.g. 1500000',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { 
        name: 'Details JSON.Health Cover', 
        label: 'Health Sum Insured (₹)', 
        type: 'number', 
        placeholder: 'e.g. 2500000',
        condition: (fd) => (fd['Details JSON']?.['Policy Type'] || '').includes('Health')
      },
      { name: 'Acquisition Date', label: 'Policy Commencement Date (DOC)', type: 'date' },
      { 
        name: 'Details JSON.Policy Term', 
        label: 'Total Policy Term (Years)', 
        type: 'number', 
        placeholder: '25',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { 
        name: 'Details JSON.Premium Paying Term', 
        label: 'Premium Paying Term - PPT (Years)', 
        type: 'number', 
        placeholder: '16',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      
      // Regular Premium Cashflow Details
      { name: 'Details JSON.Premium Amount', label: 'Regular Premium Installment (₹)', type: 'number', required: true },
      { 
        name: 'Details JSON.Premium Frequency', 
        label: 'Premium Frequency Mode', 
        type: 'select', 
        options: ['Yearly', 'Half-Yearly', 'Quarterly', 'Monthly NACH/ECS', 'Single Premium']
      },
      { name: 'Details JSON.Next Due Date', label: 'Next Premium Due Date', type: 'date', required: true },
      { name: 'Details JSON.Grace Period Days', label: 'Grace Period (Days)', type: 'number' },
      
      // Maturity & Nominee
      { 
        name: 'Details JSON.Maturity Date', 
        label: 'Maturity Date', 
        type: 'date',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Term') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { 
        name: 'Details JSON.Expected Maturity Amount', 
        label: 'Estimated Maturity Corpus (incl. Bonus) (₹)', 
        type: 'number',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Term') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { name: 'Owner', label: 'Life Assured / Proposer', type: 'text', placeholder: 'e.g. Self' },
      { name: 'Nominee', label: 'Nominee Name & Relationship', type: 'text', placeholder: 'e.g. Jane Doe (Spouse) - 100%' }
    ]
  },
  'Insurance': {
    title: 'Insurance Policies',
    fields: [
      { name: 'Name', label: 'Policy Name / Scheme', type: 'text', placeholder: 'e.g. LIC Jeevan Labh, HDFC Click 2 Protect', required: true },
      { 
        name: 'Details JSON.Policy Type', 
        label: 'Policy Category / Type', 
        type: 'select', 
        options: [
          'Endowment Plan (Savings + Life Cover)',
          'Money Back Plan (Periodic Survival Benefits)',
          'Whole Life Plan (e.g. Jeevan Umang)',
          'ULIP (Unit Linked Insurance Plan)',
          'Pension / Immediate Annuity Plan',
          'Pure Term Insurance (Risk Protection Only)',
          'Health Insurance (Mediclaim)',
          'Motor & Vehicle Insurance'
        ],
        required: true
      },
      { name: 'Institution/Location', label: 'Insurer / Organization', type: 'text', placeholder: 'e.g. Life Insurance Corporation of India (LIC)' },
      { name: 'Identifiers', label: 'Policy Number', type: 'text', placeholder: 'e.g. 863920192', required: true },
      { name: 'Details JSON.Servicing Branch', label: 'Servicing Branch & Code', type: 'text', placeholder: 'e.g. Mumbai Branch 883' },
      { name: 'Cost', label: 'Cumulative Premiums Paid to Date (₹)', type: 'number', required: true },
      { name: 'Current Value', label: 'Current Surrender / Accrued Value (₹)', type: 'number', required: true },
      { 
        name: 'Details JSON.Sum Assured', 
        label: 'Life Cover / Sum Assured (₹)', 
        type: 'number', 
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { 
        name: 'Details JSON.Health Cover', 
        label: 'Health Sum Insured (₹)', 
        type: 'number', 
        condition: (fd) => (fd['Details JSON']?.['Policy Type'] || '').includes('Health')
      },
      { name: 'Acquisition Date', label: 'Policy Commencement Date (DOC)', type: 'date' },
      { 
        name: 'Details JSON.Policy Term', 
        label: 'Total Policy Term (Years)', 
        type: 'number',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { 
        name: 'Details JSON.Premium Paying Term', 
        label: 'Premium Paying Term - PPT (Years)', 
        type: 'number',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { name: 'Details JSON.Premium Amount', label: 'Regular Premium Installment (₹)', type: 'number', required: true },
      { 
        name: 'Details JSON.Premium Frequency', 
        label: 'Premium Frequency Mode', 
        type: 'select', 
        options: ['Yearly', 'Half-Yearly', 'Quarterly', 'Monthly NACH/ECS', 'Single Premium']
      },
      { name: 'Details JSON.Next Due Date', label: 'Next Premium Due Date', type: 'date', required: true },
      { name: 'Details JSON.Grace Period Days', label: 'Grace Period (Days)', type: 'number' },
      { 
        name: 'Details JSON.Maturity Date', 
        label: 'Maturity Date', 
        type: 'date',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Term') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { 
        name: 'Details JSON.Expected Maturity Amount', 
        label: 'Estimated Maturity Corpus (incl. Bonus) (₹)', 
        type: 'number',
        condition: (fd) => !(fd['Details JSON']?.['Policy Type'] || '').includes('Term') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Health') && !(fd['Details JSON']?.['Policy Type'] || '').includes('Motor')
      },
      { name: 'Owner', label: 'Life Assured / Proposer', type: 'text', placeholder: 'e.g. Self' },
      { name: 'Nominee', label: 'Nominee Name & Relationship', type: 'text', placeholder: 'e.g. Jane Doe (Spouse) - 100%' }
    ]
  },
  'default': {
    title: 'Asset Details',
    fields: [
      { name: 'Name', label: 'Asset Name', type: 'text', required: true },
      { name: 'Category', label: 'Category', type: 'text', required: true },
      { name: 'Cost', label: 'Cost / Invested Amount', type: 'number' },
      { name: 'Current Value', label: 'Current Value', type: 'number', required: true },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  }
};
