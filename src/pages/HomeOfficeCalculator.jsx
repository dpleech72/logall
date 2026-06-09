import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'

// HMRC flat rate bands (2024/25 onwards)
const FLAT_RATE_BANDS = [
  { label: '25–50 hrs/month', min: 25, max: 50,  monthly: 10 },
  { label: '51–100 hrs/month', min: 51, max: 100, monthly: 18 },
  { label: '101+ hrs/month',  min: 101, max: Infinity, monthly: 26 },
]

function currency(n) {
  return `£${n.toFixed(2)}`
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">{title}</p>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, prefix, suffix, value, onChange, type = 'number', min = '0' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{hint}</p>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-gray-400 text-sm">{prefix}</span>}
        <input
          type={type}
          min={min}
          value={value}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`w-full py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white ${prefix ? 'pl-7 pr-4' : suffix ? 'pl-4 pr-12' : 'px-4'}`}
        />
        {suffix && <span className="absolute right-3 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </div>
  )
}

export default function HomeOfficeCalculator() {
  const navigate = useNavigate()
  const [method, setMethod] = useState('flat')

  // Flat rate inputs
  const [hoursPerMonth, setHoursPerMonth] = useState(40)

  // Actual cost inputs
  const [workRooms, setWorkRooms] = useState(1)
  const [totalRooms, setTotalRooms] = useState(5)
  const [monthlyRent, setMonthlyRent] = useState('')
  const [monthlyCouncilTax, setMonthlyCouncilTax] = useState('')
  const [monthlyUtilities, setMonthlyUtilities] = useState('')
  const [monthlyBroadband, setMonthlyBroadband] = useState('')
  const [businessUsePct, setBusinessUsePct] = useState(50)

  // Flat rate calc
  const flatBand = FLAT_RATE_BANDS.find(b => hoursPerMonth >= b.min && hoursPerMonth <= b.max)
  const flatMonthly = flatBand?.monthly ?? 0
  const flatAnnual = flatMonthly * 12

  // Actual cost calc
  const roomRatio = totalRooms > 0 ? workRooms / totalRooms : 0
  const totalMonthlyBills = (Number(monthlyRent) || 0) + (Number(monthlyCouncilTax) || 0) +
    (Number(monthlyUtilities) || 0) + (Number(monthlyBroadband) || 0)
  const actualMonthly = totalMonthlyBills * roomRatio * (businessUsePct / 100)
  const actualAnnual = actualMonthly * 12

  const betterMethod = actualAnnual > flatAnnual ? 'actual' : 'flat'
  const saving = Math.abs(actualAnnual - flatAnnual)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center z-10">
        <button onClick={() => navigate('/tax')} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm">
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Home Office Calculator</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Work out how much you can claim for working from home</p>
        </div>

        {/* Info banner */}
        <div className="flex gap-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
          <Info size={15} className="flex-shrink-0 mt-0.5" />
          <p>HMRC allows sole traders to claim a proportion of home running costs when working from home. Choose the method that gives the higher deduction.</p>
        </div>

        {/* Method picker */}
        <div className="flex gap-2">
          {[
            { value: 'flat',   label: 'Flat rate',    sub: 'Simple — based on hours' },
            { value: 'actual', label: 'Actual costs', sub: 'Based on your bills' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setMethod(opt.value)}
              className={`flex-1 py-3 px-4 rounded-xl border-2 text-left transition-colors ${method === opt.value ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
              <p className={`text-sm font-semibold ${method === opt.value ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}>{opt.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>

        {method === 'flat' && (
          <Section title="Flat rate method">
            <Field
              label="Hours worked from home per month"
              hint="Average across the year — only count hours actually doing business work"
              suffix="hrs"
              value={hoursPerMonth}
              onChange={setHoursPerMonth}
            />
            <div className="space-y-2">
              {FLAT_RATE_BANDS.map(band => (
                <div key={band.label}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm ${hoursPerMonth >= band.min && hoursPerMonth <= band.max ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                  <span className={`${hoursPerMonth >= band.min && hoursPerMonth <= band.max ? 'text-green-700 dark:text-green-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>{band.label}</span>
                  <span className={`font-semibold ${hoursPerMonth >= band.min && hoursPerMonth <= band.max ? 'text-green-700 dark:text-green-300' : 'text-gray-400 dark:text-gray-500'}`}>£{band.monthly}/month</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Annual claimable amount</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{currency(flatAnnual)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{currency(flatMonthly)}/month × 12</p>
              </div>
              {hoursPerMonth < 25 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 max-w-[140px] text-right">Minimum 25 hrs/month required to claim flat rate</p>
              )}
            </div>
          </Section>
        )}

        {method === 'actual' && (
          <Section title="Actual costs method">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rooms used for work" value={workRooms} onChange={setWorkRooms} min="1" />
              <Field label="Total rooms in home" hint="Exclude bathrooms" value={totalRooms} onChange={setTotalRooms} min="1" />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              Room ratio: {workRooms} of {totalRooms} rooms = <strong>{totalRooms > 0 ? ((workRooms / totalRooms) * 100).toFixed(0) : 0}%</strong> of home costs
            </div>
            <Field label="Monthly rent or mortgage interest" prefix="£" value={monthlyRent} onChange={setMonthlyRent} />
            <Field label="Monthly council tax" prefix="£" value={monthlyCouncilTax} onChange={setMonthlyCouncilTax} />
            <Field label="Monthly utilities (gas, electricity, water)" prefix="£" value={monthlyUtilities} onChange={setMonthlyUtilities} />
            <Field label="Monthly broadband" prefix="£" value={monthlyBroadband} onChange={setMonthlyBroadband} />
            <Field
              label="Estimated business use of that room"
              hint="e.g. 50% if you also use the room personally"
              suffix="%"
              value={businessUsePct}
              onChange={v => setBusinessUsePct(Math.min(100, Math.max(0, v)))}
              min="0"
            />
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Calculation</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                £{totalMonthlyBills.toFixed(2)}/mo total bills × {totalRooms > 0 ? ((workRooms / totalRooms) * 100).toFixed(0) : 0}% room ratio × {businessUsePct}% business use
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{currency(actualAnnual)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{currency(actualMonthly)}/month × 12</p>
            </div>
          </Section>
        )}

        {/* Comparison */}
        {(flatAnnual > 0 || actualAnnual > 0) && (
          <Section title="Compare methods">
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-3 border-2 ${betterMethod === 'flat' ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">Flat rate</p>
                <p className={`text-xl font-bold mt-1 ${betterMethod === 'flat' ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}>{currency(flatAnnual)}</p>
                {betterMethod === 'flat' && <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">Better for you ✓</p>}
              </div>
              <div className={`rounded-xl p-3 border-2 ${betterMethod === 'actual' ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">Actual costs</p>
                <p className={`text-xl font-bold mt-1 ${betterMethod === 'actual' ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}>{currency(actualAnnual)}</p>
                {betterMethod === 'actual' && <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">Better for you ✓</p>}
              </div>
            </div>
            {saving > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                The {betterMethod === 'flat' ? 'flat rate' : 'actual costs'} method saves you an extra <span className="font-semibold text-green-600">{currency(saving)}/year</span>
              </p>
            )}
          </Section>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed pb-4">
          If you use the actual costs method, HMRC may require detailed evidence of your bills and usage. The flat rate is simpler but may give a lower deduction.
          LogAll is not a substitute for professional tax advice.
        </p>
      </div>
    </div>
  )
}
