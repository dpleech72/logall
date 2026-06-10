// HMRC Approved Mileage Allowance Payments (AMAP) for cars and vans.
// 2026/27: 55p per mile for the first 10,000 business miles in the tax year,
// then 25p for each mile above that. (Raised from 45p, backdated to 6 Apr 2026.)
export const MILEAGE_RATE_HIGH = 0.55
export const MILEAGE_RATE_LOW  = 0.25
export const MILEAGE_THRESHOLD = 10000

// Total allowable claim for a given number of business miles in a tax year,
// applying the 25p tier above 10,000 miles.
export function mileageClaim(miles) {
  const m = parseFloat(miles) || 0
  if (m <= MILEAGE_THRESHOLD) return m * MILEAGE_RATE_HIGH
  return MILEAGE_THRESHOLD * MILEAGE_RATE_HIGH + (m - MILEAGE_THRESHOLD) * MILEAGE_RATE_LOW
}

// Marginal claim for `miles` of extra travel when `milesSoFar` have already
// been logged this tax year — used to value a single new journey correctly
// once the 10,000-mile threshold is in play.
export function marginalMileageClaim(miles, milesSoFar = 0) {
  const before = parseFloat(milesSoFar) || 0
  const extra  = parseFloat(miles) || 0
  return mileageClaim(before + extra) - mileageClaim(before)
}
