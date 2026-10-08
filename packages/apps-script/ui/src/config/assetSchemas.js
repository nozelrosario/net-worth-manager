export const assetSchemas = {
  'Cash/FD': {
    title: 'Bank & Fixed Deposits',
    fields: [
      { name: 'Institution/Location', label: 'Institution / Bank Name', type: 'text', placeholder: 'e.g. State Bank of India' },
      { name: 'Identifiers', label: 'Account / FD Number', type: 'text', placeholder: 'e.g. FD A/c #9402810482' },
      { name: 'Cost', label: 'Deposit Principal', type: 'number' },
      { name: 'Current Value', label: 'Current Value', type: 'number', required: true },
      { name: 'Acquisition Date', label: 'Deposit Date', type: 'date' },
      { name: 'Details JSON.Maturity Date', label: 'Maturity Date', type: 'date' },
      { name: 'Details JSON.Interest Rate', label: 'Interest Rate (% p.a.)', type: 'number', step: '0.01' },
      { name: 'Details JSON.Payout Frequency', label: 'Payout Frequency Mode', type: 'select', options: ['Cumulative', 'Monthly', 'Quarterly', 'Annual'] },
      { name: 'Details JSON.Auto Renewal', label: 'Auto-Renewal', type: 'checkbox' },
      { name: 'Owner', label: 'Holding Pattern / Owner', type: 'text', placeholder: 'e.g. Joint, Single' },
      { name: 'Nominee', label: 'Nominee Name', type: 'text' }
    ]
  },
  'Equity': {
    title: 'Direct Equity / Stocks',
    fields: [
      { name: 'Name', label: 'Company / Ticker', type: 'text', placeholder: 'e.g. Reliance Industries', required: true },
      { name: 'Institution/Location', label: 'Broker / Demat Account', type: 'text', placeholder: 'e.g. Zerodha' },
      { name: 'Details JSON.Quantity', label: 'Quantity (Shares)', type: 'number' },
      { name: 'Details JSON.Average Buy Price', label: 'Average Buy Price', type: 'number', step: '0.01' },
      { name: 'Cost', label: 'Total Invested Amount', type: 'number' },
      { name: 'Current Value', label: 'Current Value', type: 'number', required: true },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  },
  'Mutual Funds': {
    title: 'Mutual Funds',
    fields: [
      { name: 'Name', label: 'Scheme Name', type: 'text', required: true },
      { name: 'Institution/Location', label: 'AMC / Fund House', type: 'text' },
      { name: 'Identifiers', label: 'Folio Number', type: 'text' },
      { name: 'Details JSON.Units', label: 'Units Held', type: 'number', step: '0.001' },
      { name: 'Details JSON.Average NAV', label: 'Average Purchase NAV', type: 'number', step: '0.0001' },
      { name: 'Cost', label: 'Total Invested Amount', type: 'number' },
      { name: 'Current Value', label: 'Current Value', type: 'number', required: true },
      { name: 'Details JSON.SIP Active', label: 'SIP Active', type: 'checkbox' },
      { name: 'Details JSON.SIP Amount', label: 'SIP Amount', type: 'number' },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  },
  'Real Estate': {
    title: 'Real Estate',
    fields: [
      { name: 'Name', label: 'Property Nickname', type: 'text', required: true },
      { name: 'Details JSON.Property Type', label: 'Type', type: 'select', options: ['Residential', 'Commercial', 'Plot', 'Agricultural'] },
      { name: 'Institution/Location', label: 'Full Address / Location', type: 'text' },
      { name: 'Acquisition Date', label: 'Purchase Date', type: 'date' },
      { name: 'Cost', label: 'Purchase Price (incl. Registration)', type: 'number' },
      { name: 'Current Value', label: 'Current Estimated Market Value', type: 'number', required: true },
      { name: 'Details JSON.Loan Linked', label: 'Linked Home Loan', type: 'checkbox' },
      { name: 'Details JSON.Rented Out', label: 'Is Rented Out?', type: 'checkbox' },
      { name: 'Details JSON.Monthly Rent', label: 'Monthly Rent Amount', type: 'number' },
      { name: 'Owner', label: 'Ownership / Co-owners', type: 'text' }
    ]
  },
  'Gold': {
    title: 'Gold & Precious Metals',
    fields: [
      { name: 'Name', label: 'Asset Name', type: 'text', required: true },
      { name: 'Details JSON.Form Factor', label: 'Type', type: 'select', options: ['Physical Jewelry', 'Sovereign Gold Bonds (SGB)', 'Gold Coins/Bars', 'Digital Gold', 'Gold ETFs'] },
      { name: 'Details JSON.Weight (Grams)', label: 'Quantity / Weight (Grams)', type: 'number', step: '0.01' },
      { name: 'Acquisition Date', label: 'Purchase Date', type: 'date' },
      { name: 'Cost', label: 'Purchase Value', type: 'number' },
      { name: 'Current Value', label: 'Current Value', type: 'number', required: true },
      { name: 'Institution/Location', label: 'Location (Locker / Home Safe)', type: 'text' },
      { name: 'Owner', label: 'Owner', type: 'text' }
    ]
  },
  'Provident Funds': {
    title: 'Provident Funds & NPS',
    fields: [
      { name: 'Name', label: 'Account Nickname', type: 'text', required: true },
      { name: 'Details JSON.Fund Type', label: 'Type', type: 'select', options: ['EPF', 'PPF', 'NPS Tier 1', 'NPS Tier 2'] },
      { name: 'Identifiers', label: 'Account Number (UAN/PRAN)', type: 'text' },
      { name: 'Institution/Location', label: 'Institution', type: 'text', placeholder: 'e.g. EPFO, Post Office' },
      { name: 'Cost', label: 'Total Contributions', type: 'number' },
      { name: 'Current Value', label: 'Current Balance', type: 'number', required: true },
      { name: 'Details JSON.Monthly Contribution', label: 'Monthly Contribution', type: 'number' },
      { name: 'Details JSON.Maturity Date', label: 'Maturity / Lock-in Expiry Date', type: 'date' },
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
