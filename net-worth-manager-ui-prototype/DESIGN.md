# Net Worth Manager - Design Tokens

## Branding
- App Name: "Net Worth Manager"
- Target: Mobile Native (393px × 852px base viewport, high-density OLED display)

## Color Palette
- Background Root: Dark Slate `#0B0F17`
- Surface / Cards Layer 1: `#151C28`
- Surface / Cards Layer 2 (Elevated): `#1E293B`
- Borders & Dividers: 1px solid `#222F3E` or `#334155`
- Primary Accent: Deep Indigo / Violet `#6366F1` (Active states, primary CTAs)
- Wealth / Profit Accent: Vibrant Emerald `#10B981` (Gains, positive cashflow, verified state)
- Bullion / Warning Accent: Amber Gold `#F59E0B` (Gold spot feeds, nomination missing alert)
- Liability / Outflow Accent: Crimson Rose `#F43F5E` (Debts, expense debits, critical missing data)
- Text Hierarchy: Primary `#F8FAFC`, Secondary `#94A3B8`, Muted/Tertiary `#64748B`

## Typography
- Font Family: SF Pro / Inter
- Features: Strict tabular lining numbers (`font-variant-numeric: tabular-nums`) for currency values and dates.
- Number Formatting: Strictly Indian numbering standard (e.g., ₹4,82,45,000 / ₹18.50 L / ₹64,200).
- Privacy Masking Global Rule: When active, every sensitive balance replaces numbers with "₹ ••••••".
