import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, Check, AlertCircle, Trash2, Receipt, Info, Pencil } from 'lucide-react'

const CATEGORIES = [
  { value: 'cleaning_products', label: 'Cleaning products', emoji: '🧴' },
  { value: 'equipment',         label: 'Equipment',         emoji: '🔧' },
  { value: 'clothing_ppe',      label: 'Clothing & PPE',    emoji: '👗' },
  { value: 'insurance',         label: 'Insurance',         emoji: '🛡️' },
  { value: 'phone',             label: 'Phone',             emoji: '📱' },
  { value: 'other',             label: 'Other',             emoji: '📦' },
]

const TAX_RATE = 0.20

function groupByMonth(expenses) {
  const groups = {}
  expenses.forEach(item => {
    const date = new Date(item.expense_date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { label, items: [], total: 0, taxSaved: 0 }
    groups[key].items.push(item)
    groups[key].total += parseFloat(item.amount)
    groups[key].taxSaved += parseFloat(item.amount) * TAX_RATE
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v)
}

function WhatCanIClaimSheet({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">What can I claim?</h2>
          <button onClick={onClose} className="p-2 text-gray-400"><X size={20} /></button>
        </div>
        <div className="space-y-4 text-sm text-gray-700">
          {[
            { emoji: '🧴', title: 'Cleaning products', body: 'Anything you buy to do the job — sprays, cloths, mops, hoovers, gloves. Keep your receipts.' },
            { emoji: '🔧', title: 'Equipment', body: 'Tools and equipment used for work. Claim the full cost in the year you buy it via Annual Investment Allowance (AIA). Includes a new vacuum cleaner, steam cleaner, or gardening tools.' },
            { emoji: '👗', title: 'Clothing & PPE', body: 'Protective clothing worn only for work — overalls, gloves, safety boots, aprons. You cannot claim ordinary clothes even if you wear them for work.' },
            { emoji: '🛡️', title: 'Insurance', body: 'Public liability insurance is tax deductible. So is professional indemnity insurance if relevant to your trade.' },
            { emoji: '📱', title: 'Phone', body: 'If you use your phone for work, you can claim the business-use portion. If it\'s used 50% for work, claim 50% of the cost.' },
            { emoji: '🚗', title: 'Mileage vs fuel', body: 'If you claim mileage at 55p/mile you CANNOT also claim fuel or charging costs. Pick one — mileage is almost always better.' },
            { emoji: '❌', title: 'What you cannot claim', body: 'Food and drink, regular clothing, fines, personal expenses, or anything not wholly used for work.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="text-2xl flex-shrink-0">{item.emoji}</span>
              <div>
                <p className="font-semibold text-gray-900 mb-0.5">{item.title}</p>
                <p className="text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LogExpenseSheet({ expense, onClose, onSaved }) {
  const [form, setForm] = useState({
    category: expense?.category || '',
    description: expense?.description || '',
    amount: expense?.amount ? String(expense.amount) : '',
    expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
    is_aia: expense?.is_aia || false,
    notes: expense?.notes || '',
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
    }
    const { error } = expense
      ? await supabase.from('expenses').update(payload).eq('id', expense.id)
      : await supabase.from('expenses').insert({ ...payload, user_id: user.id })

    if (error) { setError(error.message); setLoading(false) }
    else { onSaved() }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white rounded-t-3xl p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{expense ? 'Edit expense' : 'Log an expense'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400"><X size={20} /></button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setForm(f => ({
                      ...f,
                      category: cat.value,
                      is_aia: cat.value === 'equipment',
                    }))
                  }}
                  className={`py-3 px-2 rounded-xl border-2 text-center transition-colors ${
                    form.category === cat.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="text-xl mb-1">{cat.emoji}</div>
                  <div className={`text-xs font-semibold ${form.category === cat.value ? 'text-green-700' : 'text-gray-600'}`}>
                    {cat.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AIA toggle for equipment */}
          {form.category === 'equipment' && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="aia"
                  checked={form.is_aia}
                  onChange={set('is_aia')}
                  className="mt-0.5 accent-green-600"
                />
                <label htmlFor="aia" className="text-xs text-purple-700 leading-relaxed">
                  <span className="font-semibold">Claim via Annual Investment Allowance (AIA)</span> — claim the full cost in this tax year rather than spreading it over several years. Recommended for most equipment purchases.
                </label>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">What did you buy?</label>
            <input
              type="text"
              placeholder="e.g. Fairy washing up liquid, Flash spray"
              value={form.description}
              onChange={set('description')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">How much did it cost?</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={set('amount')}
                className="w-full pl-7 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {form.amount > 0 && (
              <p className="text-xs text-green-600 font-medium mt-1.5">
                💰 This saves you £{taxSaving} in tax
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input
              type="date"
              value={form.expense_date}
              onChange={set('expense_date')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Bought from Asda"
              value={form.notes}
              onChange={set('notes')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
{loading ? 'Saving...' : expense ? 'Save changes' : 'Log expense'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editExpense, setEditExpense] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeleteId(null)
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)
  const totalTaxSaved = totalExpenses * TAX_RATE
  const groups = groupByMonth(expenses)

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">Things you buy for work</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(true)}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 active:bg-gray-50"
          >
            <Info size={18} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-purple-600 rounded-2xl p-4 text-white">
          <p className="text-purple-100 text-xs font-medium mb-1">Total expenses</p>
          <p className="text-2xl font-bold">£{totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-green-600 rounded-2xl p-4 text-white">
          <p className="text-green-100 text-xs font-medium mb-1">Tax saved</p>
          <p className="text-2xl font-bold">£{totalTaxSaved.toFixed(2)}</p>
          <p className="text-green-100 text-xs mt-0.5">at 20% basic rate</p>
        </div>
      </div>

      {/* Mileage warning */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
        ⚠️ If you claim mileage at 55p/mile you cannot also claim fuel or car running costs.
      </div>

      {/* Empty state */}
      {!loading && expenses.length === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="text-4xl">🧾</div>
          <p className="font-semibold text-gray-700">No expenses logged yet</p>
          <p className="text-gray-400 text-sm">Cleaning products, equipment, insurance — it all reduces your tax bill</p>
          <button
            onClick={() => setShowGuide(true)}
            className="mt-1 text-green-600 font-semibold text-sm"
          >
            What can I claim? →
          </button>
        </div>
      )}

      {/* Expense groups */}
      {groups.map(group => (
        <div key={group.label} className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-500">{group.label}</p>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-700">£{group.total.toFixed(2)}</p>
              <p className="text-xs text-green-600">saves £{group.taxSaved.toFixed(2)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {group.items.map(expense => {
              const cat = CATEGORIES.find(c => c.value === expense.category)
              return (
                <div key={expense.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 text-lg">
                    {cat?.emoji || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{expense.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {new Date(expense.expense_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-gray-400">{cat?.label}</span>
                      {expense.is_aia && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">AIA</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-1">
                    <p className="font-bold text-gray-800">£{parseFloat(expense.amount).toFixed(2)}</p>
                    <p className="text-xs text-green-600">saves £{(parseFloat(expense.amount) * TAX_RATE).toFixed(2)}</p>
                  </div>
                  <div className="flex flex-row gap-1 flex-shrink-0">
                    <button onClick={() => setEditExpense(expense)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-400 active:bg-blue-100">
                      <Pencil size={20} />
                    </button>
                    <button onClick={() => setDeleteId(expense.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-400 active:bg-red-100">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-24">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 mb-1">Delete this expense?</p>
            <p className="text-sm text-gray-500 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showForm && <LogExpenseSheet onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
      {editExpense && <LogExpenseSheet expense={editExpense} onClose={() => setEditExpense(null)} onSaved={() => { setEditExpense(null); fetchData() }} />}
      {showGuide && <WhatCanIClaimSheet onClose={() => setShowGuide(false)} />}
    </div>
  )
}
