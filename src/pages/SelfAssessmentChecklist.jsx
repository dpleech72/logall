import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, RotateCcw } from 'lucide-react'

const CHECKLIST = [
  {
    group: 'Your records',
    items: [
      { id: 'income_logged',   label: 'All income logged for the tax year',           hint: 'Every payment received between 6 Apr and 5 Apr' },
      { id: 'expenses_logged', label: 'All expenses logged and categorised',           hint: 'Cleaning products, equipment, insurance, phone, etc.' },
      { id: 'mileage_logged',  label: 'All business mileage logged',                  hint: 'Every work journey recorded with date and route' },
      { id: 'receipts',        label: 'Receipts saved for expenses over £10',         hint: 'Stored in Google Drive or paper copies kept' },
      { id: 'bank_match',      label: 'Income matches bank statements',               hint: 'Cross-check your records against what landed in your account' },
    ],
  },
  {
    group: 'Personal details',
    items: [
      { id: 'utr',             label: 'UTR number to hand',                           hint: '10-digit Unique Taxpayer Reference from HMRC' },
      { id: 'ni_number',       label: 'National Insurance number to hand',            hint: 'Format: AB 12 34 56 C' },
      { id: 'bank_details',    label: 'Bank details ready (for any refund)',           hint: 'Sort code and account number' },
      { id: 'gateway',         label: 'HMRC Government Gateway login working',        hint: 'Test it before January — resets can take days' },
    ],
  },
  {
    group: 'Other income',
    items: [
      { id: 'p60',             label: 'P60 / P45 if also employed',                   hint: 'From any employer during the tax year' },
      { id: 'savings',         label: 'Savings interest figures',                     hint: 'From your bank — only reportable above your savings allowance' },
      { id: 'rental',          label: 'Rental income figures (if applicable)',         hint: 'Any income from property you let out' },
      { id: 'dividends',       label: 'Dividend income (if applicable)',               hint: 'If you own shares or are a company director' },
    ],
  },
  {
    group: 'Deductions & reliefs',
    items: [
      { id: 'home_office',     label: 'Home office allowance calculated',             hint: 'Flat rate or actual cost method — see Home Office Calculator' },
      { id: 'pension',         label: 'Pension contributions noted',                  hint: 'Personal pension payments may reduce your tax bill' },
      { id: 'gift_aid',        label: 'Gift Aid donations noted',                     hint: 'Charitable donations under Gift Aid are tax-deductible' },
      { id: 'student_loan',    label: 'Student loan plan type noted (if applicable)', hint: 'Plan 1, 2, 4, or Postgraduate — affects repayment threshold' },
    ],
  },
  {
    group: 'Filing',
    items: [
      { id: 'deadline',        label: 'Online deadline noted: 31 January',            hint: 'Paper deadline is 31 October — online filing gives you longer' },
      { id: 'payment_account', label: 'Payment on account understood',                hint: 'HMRC may ask for 50% of next year\'s bill upfront alongside this year\'s' },
      { id: 'filed',           label: 'Return submitted to HMRC ✓',                   hint: 'Done! Keep your submission reference number safe' },
    ],
  },
]

const STORAGE_KEY = 'logall_sa_checklist'

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}

export default function SelfAssessmentChecklist() {
  const navigate = useNavigate()
  const now = new Date()
  const tyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const taxYearLabel = `${tyStart}/${String(tyStart + 1).slice(2)}`
  const deadline = `31 January ${tyStart + 2}`

  const [checked, setChecked] = useState(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
  }, [checked])

  const allItems = CHECKLIST.flatMap(g => g.items)
  const doneCount = allItems.filter(i => checked[i.id]).length
  const pct = Math.round((doneCount / allItems.length) * 100)

  function toggle(id) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function reset() {
    setChecked({})
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={() => navigate('/tax')} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm">
          <ArrowLeft size={18} /> Back
        </button>
        <button onClick={reset} className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-xs">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Self Assessment Checklist</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Tax year {taxYearLabel} · Deadline {deadline}</p>
        </div>

        {/* Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{doneCount} of {allItems.length} done</p>
            <p className="text-sm font-bold text-green-600">{pct}%</p>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          {pct === 100 && (
            <p className="text-xs text-green-600 font-medium mt-2">You're ready to file! 🎉</p>
          )}
        </div>

        {/* Groups */}
        {CHECKLIST.map(group => (
          <div key={group.group}>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">{group.group}</p>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              {group.items.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-gray-700 ${idx > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}
                >
                  {checked[item.id]
                    ? <CheckCircle2 size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                    : <Circle size={20} className="text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${checked[item.id] ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{item.hint}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed pb-4">
          This checklist is a guide only. LogAll is not a substitute for professional tax advice.
        </p>
      </div>
    </div>
  )
}
