import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Printer, Download } from 'lucide-react'

const PERSONAL_ALLOWANCE = 12570
const BASIC_RATE = 0.20
const CLASS4_RATE = 0.09
const CLASS4_LOWER = 12570
const CLASS4_UPPER = 50270
const CLASS2_WEEKLY = 3.45

function downloadCSV(rows, headers, filename) {
  const lines = [
    headers.join(','),
    ...rows.map(r => r.map(cell => {
      const s = String(cell ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const CATEGORY_LABELS = {
  cleaning_products: 'Cleaning products',
  equipment:         'Equipment',
  clothing_ppe:      'Clothing & PPE',
  insurance:         'Insurance',
  phone:             'Phone',
  other:             'Other',
}

function calcTax(profit) {
  if (profit <= 0) return { incomeTax: 0, class4: 0, class2: 0, total: 0 }
  const taxableIncome = Math.max(0, profit - PERSONAL_ALLOWANCE)
  const incomeTax = taxableIncome * BASIC_RATE
  const class4 = Math.min(Math.max(0, profit - CLASS4_LOWER), CLASS4_UPPER - CLASS4_LOWER) * CLASS4_RATE
  const class2 = profit > PERSONAL_ALLOWANCE ? CLASS2_WEEKLY * 52 : 0
  return {
    incomeTax: Math.round(incomeTax * 100) / 100,
    class4:    Math.round(class4 * 100) / 100,
    class2:    Math.round(class2 * 100) / 100,
    total:     Math.round((incomeTax + class4 + class2) * 100) / 100,
  }
}

function Row({ label, value, bold, topBorder, negative }) {
  return (
    <div className={`flex justify-between px-4 py-2.5 ${topBorder ? 'border-t-2 border-gray-700 dark:border-gray-500 bg-gray-50 dark:bg-gray-700' : 'border-t border-gray-100 dark:border-gray-700 first:border-0'}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>{label}</span>
      <span className={`text-sm font-semibold ${negative ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
        {negative ? `−£${Math.abs(value).toFixed(2)}` : `£${value.toFixed(2)}`}
      </span>
    </div>
  )
}

export default function TaxReport() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [trade, setTrade] = useState('')
  const [utr, setUtr] = useState('')
  const [niNumber, setNiNumber] = useState('')
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [mileage, setMileage] = useState([])

  const now = new Date()
  const tyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const taxYearStartDate = `${tyStart}-04-06`
  const taxYearLabel = `${tyStart}/${String(tyStart + 1).slice(2)}`
  const generatedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [
      { data: incomeData },
      { data: expenseData },
      { data: mileageData },
      { data: profile },
    ] = await Promise.all([
      supabase.from('income').select('*').gte('received_date', taxYearStartDate).order('received_date'),
      supabase.from('expenses').select('*').gte('expense_date', taxYearStartDate).order('expense_date'),
      supabase.from('mileage').select('*').gte('journey_date', taxYearStartDate).order('journey_date'),
      supabase.from('profiles').select('full_name, trade, utr, national_insurance').single(),
    ])
    setIncome(incomeData || [])
    setExpenses(expenseData || [])
    setMileage(mileageData || [])
    setProfileName(profile?.full_name || '')
    setTrade(profile?.trade || '')
    setUtr(profile?.utr || '')
    setNiNumber(profile?.national_insurance || '')
    setLoading(false)
  }

  function exportMTD() {
    // Map LogAll categories to SA103S boxes
    const box14Travel    = mileage.reduce((s, m) => s + parseFloat(m.claimable_amount), 0)
    const box15Premises  = expenses.filter(e => e.category === 'insurance').reduce((s, e) => s + parseFloat(e.amount), 0)
    const box17Phone     = expenses.filter(e => e.category === 'phone').reduce((s, e) => s + parseFloat(e.amount), 0)
    const box27AIA       = expenses.filter(e => e.category === 'equipment' && e.is_aia).reduce((s, e) => s + parseFloat(e.amount), 0)
    const box23Other     = expenses.filter(e =>
      e.category !== 'insurance' && e.category !== 'phone' && !(e.category === 'equipment' && e.is_aia)
    ).reduce((s, e) => s + parseFloat(e.amount), 0)

    const totalInc  = income.reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalExp  = box14Travel + box15Premises + box17Phone + box23Other
    const netProfit = Math.max(0, totalInc - totalExp - box27AIA)

    const rows = [
      ['HMRC Self Employment (Short) — SA103S', ''],
      ['Generated by LogAll', new Date().toLocaleDateString('en-GB')],
      ['', ''],
      ['TAXPAYER DETAILS', ''],
      ['Name', profileName],
      ['Trade / Business', trade],
      ['UTR', utr],
      ['National Insurance Number', niNumber],
      ['Tax Year', `6 April ${tyStart} to 5 April ${tyStart + 1}`],
      ['', ''],
      ['INCOME', ''],
      ['Box 9 — Turnover (total income)', totalInc.toFixed(2)],
      ['Box 10 — Any other business income', '0.00'],
      ['', ''],
      ['ALLOWABLE EXPENSES', ''],
      ['Box 14 — Car, van and travel expenses (mileage at 55p/mile)', box14Travel.toFixed(2)],
      ['Box 15 — Rent, rates, power and insurance costs', box15Premises.toFixed(2)],
      ['Box 17 — Phone, fax, stationery and other office costs', box17Phone.toFixed(2)],
      ['Box 23 — Other business expenses (cleaning, clothing, equipment)', box23Other.toFixed(2)],
      ['Box 24 — Total allowable expenses', totalExp.toFixed(2)],
      ['', ''],
      ['PROFIT', ''],
      ['Box 25 — Net profit (Turnover minus Total expenses)', netProfit.toFixed(2)],
      ['', ''],
      ['CAPITAL ALLOWANCES', ''],
      ['Box 27 — Annual Investment Allowance (AIA) on equipment', box27AIA.toFixed(2)],
      ['', ''],
      ['MILEAGE DETAIL', ''],
      ['Total miles', mileage.reduce((s, m) => s + parseFloat(m.miles), 0).toFixed(1)],
      ['Rate', '55p per mile (HMRC approved mileage allowance)'],
      ['Total mileage claim', box14Travel.toFixed(2)],
      ['', ''],
      ['NOTES', ''],
      ['This export maps to the SA103S Self Employment (Short) form.', ''],
      ['Use this with bridging software (e.g. MyTaxDigital) to file your MTD return.', ''],
      ['Verify all figures with your accountant before filing.', ''],
    ]

    downloadCSV(rows, [], `mtd-sa103s-${taxYearLabel.replace('/', '-')}.csv`)
  }

  const totalIncome   = income.reduce((s, i) => s + parseFloat(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)
  const totalMileage  = mileage.reduce((s, m) => s + parseFloat(m.claimable_amount), 0)
  const totalMiles    = mileage.reduce((s, m) => s + parseFloat(m.miles), 0)
  const totalDeductions = totalExpenses + totalMileage
  const profit = Math.max(0, totalIncome - totalDeductions)
  const tax = calcTax(profit)

  // Income grouped by month
  const incomeByMonth = {}
  income.forEach(i => {
    const key = new Date(i.received_date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!incomeByMonth[key]) incomeByMonth[key] = { total: 0, count: 0 }
    incomeByMonth[key].total += parseFloat(i.amount)
    incomeByMonth[key].count++
  })

  // Expenses grouped by category
  const expensesByCategory = {}
  expenses.forEach(e => {
    const cat = CATEGORY_LABELS[e.category] || 'Other'
    if (!expensesByCategory[cat]) expensesByCategory[cat] = 0
    expensesByCategory[cat] += parseFloat(e.amount)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Preparing report…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      {/* Screen-only toolbar */}
      <div className="print:hidden sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 z-10">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/tax')}
            className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm active:text-gray-700 dark:text-gray-200"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                downloadCSV(
                  income.map(i => [i.received_date, i.description || '', i.payment_method || '', parseFloat(i.amount).toFixed(2)]),
                  ['Date', 'Description', 'Payment Method', 'Amount (£)'],
                  `income-${taxYearLabel.replace('/', '-')}.csv`
                )
                setTimeout(() => downloadCSV(
                  expenses.map(e => [e.expense_date, CATEGORY_LABELS[e.category] || e.category, e.description || '', parseFloat(e.amount).toFixed(2), e.is_aia ? 'Yes' : 'No', e.recurring || 'One-off', e.notes || '']),
                  ['Date', 'Category', 'Description', 'Amount (£)', 'AIA', 'Recurring', 'Notes'],
                  `expenses-${taxYearLabel.replace('/', '-')}.csv`
                ), 300)
                setTimeout(() => downloadCSV(
                  mileage.map(m => [m.journey_date, m.from_location || '', m.to_location || '', parseFloat(m.miles).toFixed(1), m.rate_per_mile || 0.55, parseFloat(m.claimable_amount).toFixed(2), m.notes || '']),
                  ['Date', 'From', 'To', 'Miles', 'Rate (£/mile)', 'Claimable (£)', 'Notes'],
                  `mileage-${taxYearLabel.replace('/', '-')}.csv`
                ), 600)
              }}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold px-4 py-2 rounded-xl text-sm active:bg-gray-50"
            >
              <Download size={15} />
              Download All
            </button>
            <button
              onClick={exportMTD}
              className="flex items-center gap-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-semibold px-4 py-2 rounded-xl text-sm active:bg-blue-50"
              title="Export SA103S figures for MTD bridging software"
            >
              <Download size={15} />
              MTD Export
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2 rounded-xl text-sm active:bg-green-700"
            >
              <Printer size={15} />
              Print / Save PDF
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCSV(
              income.map(i => [i.received_date, i.description || '', i.payment_method || '', parseFloat(i.amount).toFixed(2)]),
              ['Date', 'Description', 'Payment Method', 'Amount (£)'],
              `income-${taxYearLabel.replace('/', '-')}.csv`
            )}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium px-3 py-2 rounded-xl text-xs active:bg-gray-50"
          >
            <Download size={13} /> Income CSV
          </button>
          <button
            onClick={() => downloadCSV(
              expenses.map(e => [e.expense_date, CATEGORY_LABELS[e.category] || e.category, e.description || '', parseFloat(e.amount).toFixed(2), e.is_aia ? 'Yes' : 'No', e.recurring || 'One-off', e.notes || '']),
              ['Date', 'Category', 'Description', 'Amount (£)', 'AIA', 'Recurring', 'Notes'],
              `expenses-${taxYearLabel.replace('/', '-')}.csv`
            )}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium px-3 py-2 rounded-xl text-xs active:bg-gray-50"
          >
            <Download size={13} /> Expenses CSV
          </button>
          <button
            onClick={() => downloadCSV(
              mileage.map(m => [m.journey_date, m.from_location || '', m.to_location || '', parseFloat(m.miles).toFixed(1), m.rate_per_mile || 0.55, parseFloat(m.claimable_amount).toFixed(2), m.notes || '']),
              ['Date', 'From', 'To', 'Miles', 'Rate (£/mile)', 'Claimable (£)', 'Notes'],
              `mileage-${taxYearLabel.replace('/', '-')}.csv`
            )}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium px-3 py-2 rounded-xl text-xs active:bg-gray-50"
          >
            <Download size={13} /> Mileage CSV
          </button>
        </div>
      </div>

      {/* Report body */}
      <div className="max-w-2xl mx-auto px-6 py-8 print:px-0 print:py-0">

        {/* Header */}
        <div className="flex items-start justify-between pb-5 mb-6 border-b-2 border-gray-900 dark:border-gray-600">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tax Report</h1>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm mt-1">
              Tax year {taxYearLabel} · 6 April {tyStart} – 5 April {tyStart + 1}
            </p>
            {profileName && (
              <p className="text-gray-800 dark:text-gray-100 font-semibold mt-1">{profileName}{trade ? ` — ${trade}` : ''}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-green-600">LogAll</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Generated {generatedDate}</p>
          </div>
        </div>

        {/* Summary */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Summary</h2>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
            <Row label="Total income" value={totalIncome} />
            <Row label="Business expenses" value={totalExpenses} negative />
            <Row label="Mileage claim (55p/mile)" value={totalMileage} negative />
            <Row label="Taxable profit" value={profit} bold topBorder />
            <Row label="Personal allowance" value={Math.min(profit, PERSONAL_ALLOWANCE)} negative />
            <Row label="Taxable income" value={Math.max(0, profit - PERSONAL_ALLOWANCE)} bold topBorder />
          </div>
        </section>

        {/* Estimated tax */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Estimated Tax Bill</h2>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
            <Row label="Income Tax (20% basic rate)" value={tax.incomeTax} />
            <Row label="Class 4 National Insurance (9%)" value={tax.class4} />
            <Row label="Class 2 National Insurance (£3.45/week)" value={tax.class2} />
            <Row label="Total estimated tax" value={tax.total} bold topBorder />
          </div>
          <div className="flex justify-between mt-2 px-1">
            <p className="text-xs text-gray-400 dark:text-gray-500">Self Assessment deadline: 31 January {tyStart + 2}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Set aside: £{(tax.total / 12).toFixed(2)}/month</p>
          </div>
        </section>

        {/* Income by month */}
        <section className="mb-8 print:break-inside-avoid">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-widest">Income by Month</h2>
            <span className="text-sm font-bold text-gray-900 dark:text-white">£{totalIncome.toFixed(2)}</span>
          </div>
          {Object.keys(incomeByMonth).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic px-1">No income recorded this tax year.</p>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
              {Object.entries(incomeByMonth).map(([month, data], i) => (
                <div key={month} className={`flex justify-between px-4 py-2.5 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{month}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">£{data.total.toFixed(2)}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{data.count} payment{data.count > 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-700 dark:border-gray-500 bg-gray-50 dark:bg-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">£{totalIncome.toFixed(2)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Income itemised */}
        {income.length > 0 && (
          <section className="mb-8 print:break-inside-avoid">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Income — Full Detail</h2>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <span className="w-24">Date</span>
                <span>Description</span>
                <span className="w-24 text-center hidden sm:block">Method</span>
                <span className="w-20 text-right">Amount</span>
              </div>
              {income.map((i, idx) => (
                <div key={i.id} className={`grid grid-cols-[auto_1fr_auto_auto] items-center px-4 py-2.5 ${idx > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="w-24 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(i.received_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{i.description || '—'}</span>
                  <span className="w-24 text-xs text-gray-400 dark:text-gray-500 text-center hidden sm:block capitalize">{i.payment_method || '—'}</span>
                  <span className="w-20 text-sm font-semibold text-gray-900 dark:text-white text-right">£{parseFloat(i.amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-700 dark:border-gray-500 bg-gray-50 dark:bg-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">£{totalIncome.toFixed(2)}</span>
              </div>
            </div>
          </section>
        )}

        {/* Expenses by category */}
        <section className="mb-8 print:break-inside-avoid">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-widest">Expenses by Category</h2>
            <span className="text-sm font-bold text-gray-900 dark:text-white">£{totalExpenses.toFixed(2)}</span>
          </div>
          {Object.keys(expensesByCategory).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic px-1">No expenses recorded this tax year.</p>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
              {Object.entries(expensesByCategory).map(([cat, total], i) => (
                <div key={cat} className={`flex justify-between px-4 py-2.5 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{cat}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">£{total.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-700 dark:border-gray-500 bg-gray-50 dark:bg-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">£{totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Expenses itemised */}
        {expenses.length > 0 && (
          <section className="mb-8 print:break-inside-avoid">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Expenses — Full Detail</h2>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
              <div className="grid grid-cols-[auto_auto_1fr_auto] gap-0 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <span className="w-24">Date</span>
                <span className="w-28 hidden sm:block">Category</span>
                <span>Description</span>
                <span className="w-20 text-right">Amount</span>
              </div>
              {expenses.map((e, idx) => (
                <div key={e.id} className={`grid grid-cols-[auto_auto_1fr_auto] items-center px-4 py-2.5 ${idx > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="w-24 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(e.expense_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                  <span className="w-28 text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{CATEGORY_LABELS[e.category] || e.category}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                    {e.description}
                    {e.is_aia && <span className="ml-1.5 text-xs bg-purple-50 text-purple-600 px-1 py-0.5 rounded font-medium">AIA</span>}
                  </span>
                  <span className="w-20 text-sm font-semibold text-gray-900 dark:text-white text-right">£{parseFloat(e.amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-700 dark:border-gray-500 bg-gray-50 dark:bg-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">£{totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          </section>
        )}

        {/* Mileage */}
        <section className="mb-8 print:break-inside-avoid">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-widest">Mileage</h2>
            <span className="text-sm font-bold text-gray-900 dark:text-white">£{totalMileage.toFixed(2)}</span>
          </div>
          {mileage.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic px-1">No mileage recorded this tax year.</p>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <span className="w-24">Date</span>
                <span>Route</span>
                <span className="w-16 text-center">Miles</span>
                <span className="w-20 text-right">Claim</span>
              </div>
              {mileage.map((m, idx) => (
                <div key={m.id} className={`grid grid-cols-[auto_1fr_auto_auto] items-center px-4 py-2.5 ${idx > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                  <span className="w-24 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(m.journey_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                    {m.from_location}{m.to_location ? ` → ${m.to_location}` : ''}
                  </span>
                  <span className="w-16 text-sm text-gray-500 dark:text-gray-400 text-center">{parseFloat(m.miles).toFixed(1)}</span>
                  <span className="w-20 text-sm font-semibold text-gray-900 dark:text-white text-right">£{parseFloat(m.claimable_amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Rate (HMRC approved)</span>
                <span className="text-sm text-gray-700 dark:text-gray-200">55p per mile · {totalMiles.toFixed(1)} miles total</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-700 dark:border-gray-500 bg-gray-50 dark:bg-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Claimable amount</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">£{totalMileage.toFixed(2)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            This report is an estimate based on data recorded in LogAll for tax year {taxYearLabel} (6 April {tyStart} to 5 April {tyStart + 1}).
            Calculations assume the basic rate tax band and do not account for other income sources, pension contributions, or additional reliefs.
            Please consult a qualified accountant or tax adviser before filing your Self Assessment return.
            LogAll is not a substitute for professional tax advice.
          </p>
        </div>

      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
