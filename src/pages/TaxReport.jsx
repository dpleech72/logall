import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Printer } from 'lucide-react'

const PERSONAL_ALLOWANCE = 12570
const BASIC_RATE = 0.20
const CLASS4_RATE = 0.09
const CLASS4_LOWER = 12570
const CLASS4_UPPER = 50270
const CLASS2_WEEKLY = 3.45

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
    <div className={`flex justify-between px-4 py-2.5 ${topBorder ? 'border-t-2 border-gray-800 bg-gray-50' : 'border-t border-gray-100 first:border-0'}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-semibold ${negative ? 'text-red-600' : 'text-gray-900'}`}>
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
      supabase.from('profiles').select('full_name, trade').single(),
    ])
    setIncome(incomeData || [])
    setExpenses(expenseData || [])
    setMileage(mileageData || [])
    setProfileName(profile?.full_name || '')
    setTrade(profile?.trade || '')
    setLoading(false)
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Preparing report…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Screen-only toolbar */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button
          onClick={() => navigate('/tax')}
          className="flex items-center gap-1.5 text-gray-500 text-sm active:text-gray-700"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2 rounded-xl text-sm active:bg-green-700"
        >
          <Printer size={15} />
          Print / Save as PDF
        </button>
      </div>

      {/* Report body */}
      <div className="max-w-2xl mx-auto px-6 py-8 print:px-0 print:py-0">

        {/* Header */}
        <div className="flex items-start justify-between pb-5 mb-6 border-b-2 border-gray-900">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tax Report</h1>
            <p className="text-gray-500 text-sm mt-1">
              Tax year {taxYearLabel} · 6 April {tyStart} – 5 April {tyStart + 1}
            </p>
            {profileName && (
              <p className="text-gray-800 font-semibold mt-1">{profileName}{trade ? ` — ${trade}` : ''}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-green-600">LogAll</p>
            <p className="text-xs text-gray-400 mt-1">Generated {generatedDate}</p>
          </div>
        </div>

        {/* Summary */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Summary</h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
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
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Estimated Tax Bill</h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <Row label="Income Tax (20% basic rate)" value={tax.incomeTax} />
            <Row label="Class 4 National Insurance (9%)" value={tax.class4} />
            <Row label="Class 2 National Insurance (£3.45/week)" value={tax.class2} />
            <Row label="Total estimated tax" value={tax.total} bold topBorder />
          </div>
          <div className="flex justify-between mt-2 px-1">
            <p className="text-xs text-gray-400">Self Assessment deadline: 31 January {tyStart + 2}</p>
            <p className="text-xs text-gray-400">Set aside: £{(tax.total / 12).toFixed(2)}/month</p>
          </div>
        </section>

        {/* Income by month */}
        <section className="mb-8 print:break-inside-avoid">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Income by Month</h2>
            <span className="text-sm font-bold text-gray-900">£{totalIncome.toFixed(2)}</span>
          </div>
          {Object.keys(incomeByMonth).length === 0 ? (
            <p className="text-sm text-gray-400 italic px-1">No income recorded this tax year.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {Object.entries(incomeByMonth).map(([month, data], i) => (
                <div key={month} className={`flex justify-between px-4 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="text-sm text-gray-600">{month}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">£{data.total.toFixed(2)}</span>
                    <span className="text-xs text-gray-400 ml-2">{data.count} payment{data.count > 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-800 bg-gray-50">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-sm font-semibold text-gray-900">£{totalIncome.toFixed(2)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Expenses by category */}
        <section className="mb-8 print:break-inside-avoid">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Expenses by Category</h2>
            <span className="text-sm font-bold text-gray-900">£{totalExpenses.toFixed(2)}</span>
          </div>
          {Object.keys(expensesByCategory).length === 0 ? (
            <p className="text-sm text-gray-400 italic px-1">No expenses recorded this tax year.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {Object.entries(expensesByCategory).map(([cat, total], i) => (
                <div key={cat} className={`flex justify-between px-4 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="text-sm text-gray-600">{cat}</span>
                  <span className="text-sm font-semibold text-gray-900">£{total.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-800 bg-gray-50">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-sm font-semibold text-gray-900">£{totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Mileage */}
        <section className="mb-8 print:break-inside-avoid">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Mileage</h2>
            <span className="text-sm font-bold text-gray-900">£{totalMileage.toFixed(2)}</span>
          </div>
          {mileage.length === 0 ? (
            <p className="text-sm text-gray-400 italic px-1">No mileage recorded this tax year.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-gray-600">Journeys logged</span>
                <span className="text-sm font-semibold text-gray-900">{mileage.length}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 border-t border-gray-100">
                <span className="text-sm text-gray-600">Total miles</span>
                <span className="text-sm font-semibold text-gray-900">{totalMiles.toFixed(1)} miles</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 border-t border-gray-100">
                <span className="text-sm text-gray-600">Rate (HMRC approved)</span>
                <span className="text-sm font-semibold text-gray-900">55p per mile</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-800 bg-gray-50">
                <span className="text-sm font-semibold text-gray-900">Claimable amount</span>
                <span className="text-sm font-semibold text-gray-900">£{totalMileage.toFixed(2)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-400 leading-relaxed">
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
