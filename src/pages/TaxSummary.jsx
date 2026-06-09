import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronUp, ExternalLink, Info, FileText, CheckSquare, Home } from 'lucide-react'

// UK 2025/26 tax constants
const PERSONAL_ALLOWANCE = 12570
const BASIC_RATE = 0.20
const CLASS4_RATE = 0.09
const CLASS4_LOWER = 12570
const CLASS4_UPPER = 50270
const CLASS2_WEEKLY = 3.45
const WEEKS_IN_YEAR = 52

function calcTax(profit) {
  if (profit <= 0) return { incomeTax: 0, class4: 0, class2: 0, total: 0 }

  // Income Tax
  const taxableIncome = Math.max(0, profit - PERSONAL_ALLOWANCE)
  const incomeTax = taxableIncome * BASIC_RATE

  // Class 4 NI
  const class4Base = Math.min(Math.max(0, profit - CLASS4_LOWER), CLASS4_UPPER - CLASS4_LOWER)
  const class4 = class4Base * CLASS4_RATE

  // Class 2 NI (only if profit over threshold)
  const class2 = profit > PERSONAL_ALLOWANCE ? CLASS2_WEEKLY * WEEKS_IN_YEAR : 0

  return {
    incomeTax: Math.round(incomeTax * 100) / 100,
    class4: Math.round(class4 * 100) / 100,
    class2: Math.round(class2 * 100) / 100,
    total: Math.round((incomeTax + class4 + class2) * 100) / 100,
  }
}

function TaxBar({ label, amount, total, colour }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 flex-shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 text-right text-xs font-semibold text-gray-700 dark:text-gray-200">£{amount.toFixed(2)}</div>
    </div>
  )
}

export default function TaxSummary() {
  const navigate = useNavigate()
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [mileage, setMileage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sliderIncome, setSliderIncome] = useState(null)
  const [showBreakdown, setShowBreakdown] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const taxYearStart = new Date()
    const now = new Date()
    const _d = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6)
    const start = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`

    const [{ data: incomeData }, { data: expenseData }, { data: mileageData }] = await Promise.all([
      supabase.from('income').select('amount').gte('received_date', start),
      supabase.from('expenses').select('amount').gte('expense_date', start),
      supabase.from('mileage').select('claimable_amount').gte('journey_date', start),
    ])

    const totalIncome = (incomeData || []).reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalExpenses = (expenseData || []).reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalMileage = (mileageData || []).reduce((s, i) => s + parseFloat(i.claimable_amount), 0)

    setIncome(totalIncome)
    setExpenses(totalExpenses)
    setMileage(totalMileage)
    setSliderIncome(Math.round(totalIncome))
    setLoading(false)
  }

  const totalDeductions = expenses + mileage
  const actualProfit = Math.max(0, income - totalDeductions)
  
  // Use slider value for projections
  const projectedIncome = sliderIncome ?? income
  const projectedProfit = Math.max(0, projectedIncome - totalDeductions)
  const tax = calcTax(projectedProfit)
  
  // Monthly set aside
  const monthsRemaining = Math.max(1, (() => {
    const now = new Date()
    const deadline = new Date(now.getFullYear() + (now.getMonth() >= 0 ? 1 : 0), 0, 31)
    return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24 * 30))
  })())
  const setAsideMonthly = tax.total / 12

  // Tax year label
  const now = new Date()
  const tyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const taxYearLabel = `${tyStart}/${String(tyStart + 1).slice(2)}`

  if (loading) {
    return (
      <div className="p-4 pt-6">
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:max-w-3xl md:mx-auto lg:max-w-4xl lg:p-8 space-y-4">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Summary</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mt-0.5">Tax year {taxYearLabel} · Self Assessment</p>
      </div>

      {/* Set aside card — most important */}
      <div className="bg-green-600 rounded-2xl p-5 text-white">
        <p className="text-green-100 text-sm font-medium mb-1">Set aside every month</p>
        <p className="text-5xl font-bold mb-1">£{setAsideMonthly.toFixed(2)}</p>
        <p className="text-green-100 text-sm">to cover your tax bill — do this and January won't be a shock</p>
      </div>

      {/* Estimated bill */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900 dark:text-white">Estimated tax bill</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">£{tax.total.toFixed(2)}</p>
        </div>

        {/* Breakdown toggle */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="flex items-center gap-1 text-xs text-green-600 font-medium mb-3"
        >
          {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
        </button>

        {showBreakdown && (
          <div className="space-y-2.5 mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
            <TaxBar label="Income Tax" amount={tax.incomeTax} total={tax.total} colour="bg-blue-400" />
            <TaxBar label="Class 4 NI" amount={tax.class4} total={tax.total} colour="bg-purple-400" />
            <TaxBar label="Class 2 NI" amount={tax.class2} total={tax.total} colour="bg-amber-400" />
          </div>
        )}

        <div className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
          Deadline: <span className="font-medium text-gray-600 dark:text-gray-300">31 January {tyStart + 2}</span> · 
          Based on 20% basic rate Income Tax + Class 4 NI (9%) + Class 2 NI (£3.45/week)
        </div>
      </div>

      {/* Profit breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <p className="font-semibold text-gray-900 dark:text-white">Your numbers</p>
        {[
          { label: 'Income this tax year', value: income, colour: 'text-green-600' },
          { label: 'Expenses claimed', value: -totalDeductions, colour: 'text-red-500' },
          { label: 'Taxable profit', value: actualProfit, colour: 'text-gray-900 dark:text-white', bold: true },
          { label: 'Personal allowance', value: -Math.min(actualProfit, PERSONAL_ALLOWANCE), colour: 'text-blue-500' },
          { label: 'Taxable income', value: Math.max(0, actualProfit - PERSONAL_ALLOWANCE), colour: 'text-gray-900 dark:text-white', bold: true },
        ].map(row => (
          <div key={row.label} className={`flex items-center justify-between ${row.bold ? 'pt-2 border-t border-gray-100 dark:border-gray-700' : ''}`}>
            <p className={`text-sm ${row.bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`}>{row.label}</p>
            <p className={`text-sm font-semibold ${row.colour}`}>
              £{Math.abs(row.value).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Income slider */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold text-gray-900 dark:text-white">What if my income changes?</p>
          {sliderIncome !== Math.round(income) && (
            <button
              onClick={() => setSliderIncome(Math.round(income))}
              className="text-xs text-green-600 font-medium active:opacity-60"
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Drag the slider to see how your tax bill changes</p>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">£0</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">£{(sliderIncome || 0).toLocaleString()}/year</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">£50,000</span>
        </div>

        <input
          type="range"
          min="0"
          max="50000"
          step="500"
          value={sliderIncome || 0}
          onChange={e => setSliderIncome(parseInt(e.target.value))}
          className="w-full accent-green-600 mb-4"
        />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Tax bill</p>
            <p className="font-bold text-gray-900 dark:text-white">£{tax.total.toFixed(0)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-600 mb-1">Set aside/mo</p>
            <p className="font-bold text-green-700">£{setAsideMonthly.toFixed(0)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600 mb-1">Take home</p>
            <p className="font-bold text-blue-700">£{Math.max(0, projectedProfit - tax.total).toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/tax/checklist')}
          className="flex flex-col items-start bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 active:bg-gray-50 text-left"
        >
          <div className="p-2 bg-amber-50 rounded-lg mb-2">
            <CheckSquare size={18} className="text-amber-600" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">SA Checklist</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Are you ready to file?</p>
        </button>
        <button
          onClick={() => navigate('/tax/home-office')}
          className="flex flex-col items-start bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 active:bg-gray-50 text-left"
        >
          <div className="p-2 bg-blue-50 rounded-lg mb-2">
            <Home size={18} className="text-blue-600" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">Home Office</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Calculate your allowance</p>
        </button>
      </div>

      {/* Tax report */}
      <button
        onClick={() => navigate('/tax/report')}
        className="flex items-center justify-between w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 active:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <FileText size={18} className="text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">Download tax report</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Print or save as PDF to share with your accountant</p>
          </div>
        </div>
        <ExternalLink size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
      </button>

      {/* HMRC link */}
      <a
        href="https://www.gov.uk/self-assessment-tax-returns"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 active:bg-gray-50"
      >
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">HMRC Self Assessment</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">File your return at gov.uk</p>
        </div>
        <ExternalLink size={16} className="text-gray-400 dark:text-gray-500" />
      </a>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed pb-4">
        This is an estimate based on the basic rate tax band. LogAll is not a substitute for professional tax advice.
      </p>
    </div>
  )
}
