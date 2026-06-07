import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, Check, AlertCircle, Trash2, Receipt, Info, ChevronLeft, ChevronRight, ArrowLeft, ExternalLink } from 'lucide-react'
import ReceiptUpload from '../components/ui/ReceiptUpload'

const CATEGORIES = [
  { value: 'cleaning_products', label: 'Cleaning products', emoji: '🧴' },
  { value: 'equipment',         label: 'Equipment',         emoji: '🔧' },
  { value: 'clothing_ppe',      label: 'Clothing & PPE',    emoji: '👗' },
  { value: 'insurance',         label: 'Insurance',         emoji: '🛡️' },
  { value: 'phone',             label: 'Phone',             emoji: '📱' },
  { value: 'other',             label: 'Other',             emoji: '📦' },
]

const TAX_RATE = 0.20
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function WhatCanIClaimSheet({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">What can I claim?</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500"><X size={20} /></button>
        </div>
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
          {[
            { emoji: '🧴', title: 'Cleaning products', body: 'Anything you buy to do the job — sprays, cloths, mops, hoovers, gloves. Keep your receipts.' },
            { emoji: '🔧', title: 'Equipment', body: 'Tools and equipment used for work. Claim the full cost in the year you buy it via Annual Investment Allowance (AIA). Includes a new vacuum cleaner, steam cleaner, or gardening tools.' },
            { emoji: '👗', title: 'Clothing & PPE', body: 'Protective clothing worn only for work — overalls, gloves, safety boots, aprons. You cannot claim ordinary clothes even if you wear them for work.' },
            { emoji: '🛡️', title: 'Insurance', body: 'Public liability insurance is tax deductible. So is professional indemnity insurance if relevant to your trade.' },
            { emoji: '📱', title: 'Phone', body: "If you use your phone for work, you can claim the business-use portion. If it's used 50% for work, claim 50% of the cost." },
            { emoji: '🚗', title: 'Mileage vs fuel', body: 'If you claim mileage at 55p/mile you CANNOT also claim fuel or charging costs. Pick one — mileage is almost always better.' },
            { emoji: '❌', title: 'What you cannot claim', body: 'Food and drink, regular clothing, fines, personal expenses, or anything not wholly used for work.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-2xl flex-shrink-0">{item.emoji}</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-0.5">{item.title}</p>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LogExpenseSheet({ expense, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState({
    category: expense?.category || '',
    description: expense?.description || '',
    amount: expense?.amount ? String(expense.amount) : '',
    expense_date: expense?.expense_date || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })(),
    is_aia: expense?.is_aia || false,
    notes: expense?.notes || '',
    receipt_url: expense?.receipt_url || null,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [field]: value }))
  }

  const taxSaving = form.amount ? (parseFloat(form.amount) * TAX_RATE).toFixed(2) : '0.00'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.category) { setError('Please choose a category.'); return }
    if (!form.description.trim()) { setError('Please enter a description.'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Please enter an amount.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      is_aia: form.is_aia,
      notes: form.notes || null,
      receipt_url: form.receipt_url || null,
    }
    const { error } = expense
      ? await supabase.from('expenses').update(payload).eq('id', expense.id)
      : await supabase.from('expenses').insert({ ...payload, user_id: user.id })

    if (error) { setError(error.message); setLoading(false) }
    else { onSaved() }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{expense ? 'Edit expense' : 'Log an expense'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat.value, is_aia: cat.value === 'equipment' }))}
                  className={`py-3 px-2 rounded-xl border-2 text-center transition-colors ${
                    form.category === cat.value ? 'border-green-500 bg-green-50' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="text-xl mb-1">{cat.emoji}</div>
                  <div className={`text-xs font-semibold ${form.category === cat.value ? 'text-green-700' : 'text-gray-600 dark:text-gray-300'}`}>
                    {cat.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {form.category === 'equipment' && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <input type="checkbox" id="aia" checked={form.is_aia} onChange={set('is_aia')} className="mt-0.5 accent-green-600" />
                <label htmlFor="aia" className="text-xs text-purple-700 leading-relaxed">
                  <span className="font-semibold">Claim via Annual Investment Allowance (AIA)</span> — claim the full cost in this tax year rather than spreading it over several years. Recommended for most equipment purchases.
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">What did you buy?</label>
            <input type="text" placeholder="e.g. Fairy washing up liquid, Flash spray"
              value={form.description} onChange={set('description')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">How much did it cost?</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">£</span>
              <input type="number" step="0.01" min="0" placeholder="0.00"
                value={form.amount} onChange={set('amount')}
                className="w-full pl-7 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            {form.amount > 0 && (
              <p className="text-xs text-green-600 font-medium mt-1.5">💰 This saves you £{taxSaving} in tax</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Date</label>
            <input type="date" value={form.expense_date} onChange={set('expense_date')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Notes (optional)</label>
            <input type="text" placeholder="e.g. Bought from Asda"
              value={form.notes} onChange={set('notes')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Receipt photo (optional)</label>
            <ReceiptUpload
              value={form.receipt_url}
              onChange={(url) => setForm(f => ({ ...f, receipt_url: url }))}
            />
          </div>

          <button type="button" onClick={onClose} className="w-full bg-gray-100 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-xl text-sm active:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            <Check size={16} />
            {loading ? 'Saving...' : expense ? 'Save changes' : 'Log expense'}
          </button>

          {expense && onDelete && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={() => onDelete(expense.id)}
                className="flex items-center gap-2 text-red-500 text-sm font-medium mx-auto">
                <Trash2 size={15} />
                Delete this expense
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default function Expenses() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [monthSummaries, setMonthSummaries] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [recent7, setRecent7] = useState([])
  const [taxYearTotal, setTaxYearTotal] = useState(0)
  const [taxYearTaxSaved, setTaxYearTaxSaved] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editExpense, setEditExpense] = useState(null)

  useEffect(() => { fetchTaxYearTotals() }, [])
  useEffect(() => { fetchYearSummary() }, [selectedYear])
  useEffect(() => { if (selectedMonth !== null) fetchMonthExpenses() }, [selectedMonth, selectedYear])

  async function fetchTaxYearTotals() {
    const taxYearStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const taxYearStartDate = `${taxYearStartYear}-04-06`
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const { data } = await supabase.from('expenses').select('amount')
      .gte('expense_date', taxYearStartDate)
      .lte('expense_date', todayStr)
    const total = (data || []).reduce((s, e) => s + parseFloat(e.amount), 0)
    setTaxYearTotal(total)
    setTaxYearTaxSaved(total * TAX_RATE)
  }

  async function fetchYearSummary() {
    setLoading(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth()+1).padStart(2,'0')}-${String(sevenDaysAgo.getDate()).padStart(2,'0')}`
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    const [{ data }, { data: recent }] = await Promise.all([
      supabase.from('expenses').select('expense_date, amount')
        .gte('expense_date', `${selectedYear}-01-01`)
        .lte('expense_date', `${selectedYear}-12-31`),
      supabase.from('expenses').select('*')
        .gte('expense_date', sevenDaysAgoStr)
        .lte('expense_date', todayStr)
        .order('expense_date', { ascending: false }),
    ])
    setRecent7(recent || [])

    const summaries = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0, count: 0 }))
    ;(data || []).forEach(item => {
      const month = parseInt(item.expense_date.split('-')[1]) - 1
      summaries[month].total += parseFloat(item.amount)
      summaries[month].count++
    })
    setMonthSummaries(summaries)
    setLoading(false)
  }

  async function fetchMonthExpenses() {
    setLoading(true)
    const monthStr = String(selectedMonth + 1).padStart(2, '0')
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const { data } = await supabase.from('expenses').select('*')
      .gte('expense_date', `${selectedYear}-${monthStr}-01`)
      .lte('expense_date', `${selectedYear}-${monthStr}-${String(lastDay).padStart(2,'0')}`)
      .order('expense_date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    setRecent7(prev => prev.filter(e => e.id !== id))
    fetchYearSummary()
    fetchTaxYearTotals()
    setDeleteId(null)
  }

  // Month detail view
  if (selectedMonth !== null) {
    const monthTotal = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)
    const monthTaxSaved = monthTotal * TAX_RATE
    return (
      <div className="p-4">
        <div className="pt-2 flex items-center gap-3 mb-4">
          <button onClick={() => setSelectedMonth(null)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{MONTH_NAMES[selectedMonth]} {selectedYear}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="ml-auto flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700">
            <Plus size={16} />
            Add
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-purple-600 rounded-2xl p-4 text-white">
            <p className="text-purple-100 text-xs font-medium mb-1">{MONTH_NAMES[selectedMonth]}</p>
            <p className="text-2xl font-bold">£{monthTotal.toFixed(2)}</p>
          </div>
          <div className="bg-green-600 rounded-2xl p-4 text-white">
            <p className="text-green-100 text-xs font-medium mb-1">Tax saved</p>
            <p className="text-2xl font-bold">£{monthTaxSaved.toFixed(2)}</p>
            <p className="text-green-100 text-xs mt-0.5">at 20% basic rate</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No expenses in {MONTH_NAMES[selectedMonth]}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expenses.map(expense => {
              const cat = CATEGORIES.find(c => c.value === expense.category)
              return (
                <button key={expense.id} onClick={() => setEditExpense(expense)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 text-lg">
                    {cat?.emoji || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{expense.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{cat?.label}</span>
                      {expense.is_aia && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">AIA</span>}
                      {expense.receipt_url && <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">🧾</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800 dark:text-gray-100">£{parseFloat(expense.amount).toFixed(2)}</p>
                    <p className="text-xs text-green-600">saves £{(parseFloat(expense.amount) * TAX_RATE).toFixed(2)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete this expense?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This can't be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
                <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        )}

        {(showForm || editExpense) && (
          <LogExpenseSheet
            expense={editExpense}
            onClose={() => { setShowForm(false); setEditExpense(null) }}
            onSaved={() => { setShowForm(false); setEditExpense(null); fetchMonthExpenses(); fetchYearSummary(); fetchTaxYearTotals() }}
            onDelete={(id) => { setEditExpense(null); setDeleteId(id) }}
          />
        )}
        {showGuide && <WhatCanIClaimSheet onClose={() => setShowGuide(false)} />}
      </div>
    )
  }

  // Year overview
  return (
    <div className="p-4 md:max-w-3xl md:mx-auto">
      <div className="pt-2 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Things you buy for work</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGuide(true)} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 active:bg-gray-50">
            <Info size={18} />
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-3 py-2 rounded-xl text-xs active:bg-green-700 transition-colors">
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Tax year summary */}
      {(() => {
        const tyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
        const tyLabel = `${tyStartYear}/${String(tyStartYear + 1).slice(2)}`
        return (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-purple-600 rounded-2xl p-4 text-white">
              <p className="text-purple-100 text-xs font-medium mb-1">Tax year {tyLabel}</p>
              <p className="text-2xl font-bold">£{taxYearTotal.toFixed(2)}</p>
              <p className="text-purple-100 text-xs mt-0.5">total expenses</p>
            </div>
            <div className="bg-green-600 rounded-2xl p-4 text-white">
              <p className="text-green-100 text-xs font-medium mb-1">Tax saved</p>
              <p className="text-2xl font-bold">£{taxYearTaxSaved.toFixed(2)}</p>
              <p className="text-green-100 text-xs mt-0.5">at 20% basic rate</p>
            </div>
          </div>
        )
      })()}

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
        ⚠️ If you claim mileage at 55p/mile you cannot also claim fuel or car running costs.
      </div>

      {/* Year picker */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setSelectedYear(y => y - 1)} className="p-2 text-gray-400 active:text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedYear}</p>
        <button onClick={() => setSelectedYear(y => y + 1)} disabled={selectedYear >= now.getFullYear()} className="p-2 text-gray-400 active:text-gray-600 disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Month grid */}
      {loading ? (
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({length:12}).map((_,i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {monthSummaries.map((summary, i) => {
            const isCurrentMonth = i === now.getMonth() && selectedYear === now.getFullYear()
            const hasExpenses = summary.total > 0
            const isFuture = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && i > now.getMonth())
            return (
              <button
                key={i}
                onClick={() => !isFuture && setSelectedMonth(i)}
                disabled={isFuture}
                className={`rounded-xl p-2 text-left transition-colors border-2 ${
                  isCurrentMonth ? 'border-green-500 bg-green-50'
                  : hasExpenses ? 'border-purple-200 bg-purple-50 active:bg-purple-100'
                  : isFuture ? 'border-gray-100 bg-gray-50 opacity-40'
                  : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 active:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-bold mb-1 ${isCurrentMonth ? 'text-green-700' : hasExpenses ? 'text-purple-700' : 'text-gray-400'}`}>
                  {MONTH_NAMES[i].slice(0, 3)}
                </p>
                {hasExpenses ? (
                  <>
                    <p className={`text-sm font-bold ${isCurrentMonth ? 'text-green-700' : 'text-purple-700'}`}>
                      £{summary.total.toFixed(2)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isCurrentMonth ? 'text-green-600' : 'text-purple-500'}`}>
                      {summary.count} {summary.count === 1 ? 'item' : 'items'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-transparent">£0</p>
                    <p className="text-xs mt-0.5 text-transparent">-</p>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Last 7 days */}
      {recent7.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Last 7 days</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recent7.map(expense => {
              const cat = CATEGORIES.find(c => c.value === expense.category)
              return (
                <button key={expense.id} onClick={() => setEditExpense(expense)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 text-lg">
                    {cat?.emoji || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{expense.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{cat?.label}</span>
                      {expense.is_aia && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">AIA</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800 dark:text-gray-100">£{parseFloat(expense.amount).toFixed(2)}</p>
                    <p className="text-xs text-green-600">saves £{(parseFloat(expense.amount) * TAX_RATE).toFixed(2)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-24">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete this expense?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <LogExpenseSheet
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchYearSummary(); fetchTaxYearTotals() }}
          onDelete={(id) => { setShowForm(false); setDeleteId(id) }}
        />
      )}
      {editExpense && (
        <LogExpenseSheet
          expense={editExpense}
          onClose={() => setEditExpense(null)}
          onSaved={() => { setEditExpense(null); fetchYearSummary(); fetchTaxYearTotals() }}
          onDelete={(id) => { setEditExpense(null); setDeleteId(id) }}
        />
      )}
      {showGuide && <WhatCanIClaimSheet onClose={() => setShowGuide(false)} />}
    </div>
  )
}
