// UK Income Tax and self-employed National Insurance — 2026/27 rates.
// Verified against gov.uk (June 2026). Income tax rates rise to 22/42/47%
// only from 2027/28, so update these when that year applies.
export const PERSONAL_ALLOWANCE = 12570
const BASIC_RATE_LIMIT = 50270           // top of the 20% band
const ADDITIONAL_RATE_THRESHOLD = 125140 // 45% applies above this
const BASIC_RATE = 0.20
const HIGHER_RATE = 0.40
const ADDITIONAL_RATE = 0.45
const CLASS4_LOWER = 12570
const CLASS4_UPPER = 50270
const CLASS4_MAIN_RATE = 0.06            // reduced from 9% on 6 Apr 2024
const CLASS4_UPPER_RATE = 0.02
// Class 2 NIC is no longer payable from 2024/25 — those above the Small Profits
// Threshold are treated as having paid it, so it adds nothing to the bill.

// Estimated Income Tax + Class 4 NIC on a self-employment profit.
export function calcTax(profit) {
  if (profit <= 0) return { incomeTax: 0, class4: 0, total: 0 }

  // Personal allowance tapers by £1 for every £2 of profit over £100,000
  const personalAllowance = profit > 100000
    ? Math.max(0, PERSONAL_ALLOWANCE - (profit - 100000) / 2)
    : PERSONAL_ALLOWANCE
  const taxable = Math.max(0, profit - personalAllowance)

  // Income tax bands (measured on taxable income above the allowance)
  const basicBand  = Math.max(0, BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE)              // £37,700 wide
  const higherBand = Math.max(0, (ADDITIONAL_RATE_THRESHOLD - personalAllowance) - basicBand)
  const basic      = Math.min(taxable, basicBand) * BASIC_RATE
  const higher     = Math.min(Math.max(0, taxable - basicBand), higherBand) * HIGHER_RATE
  const additional = Math.max(0, taxable - basicBand - higherBand) * ADDITIONAL_RATE
  const incomeTax  = basic + higher + additional

  // Class 4 NIC: 6% between the lower and upper limits, 2% above the upper limit
  const class4Main  = Math.min(Math.max(0, profit - CLASS4_LOWER), CLASS4_UPPER - CLASS4_LOWER) * CLASS4_MAIN_RATE
  const class4Upper = Math.max(0, profit - CLASS4_UPPER) * CLASS4_UPPER_RATE
  const class4      = class4Main + class4Upper

  return {
    incomeTax: Math.round(incomeTax * 100) / 100,
    class4:    Math.round(class4 * 100) / 100,
    total:     Math.round((incomeTax + class4) * 100) / 100,
  }
}
